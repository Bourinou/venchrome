// MV3 service worker: picks the driving tab, keeps the WS to the plugin, sends only changes.
import type { ContentToWorker, RuntimeMessage, Status, WorkerToContent } from "../messages.ts";
import { findRule } from "../rules/match.ts";
import { getRules, loadState, onStateChange } from "../storage.ts";
import { pickDriver, samePayload, type Candidate } from "./arbiter.ts";
import { createConnection, RECONNECT_ALARM } from "./connection.ts";
import { loadSession, saveSession, updateCandidates } from "./state.ts";

const TICK_ALARM = "venchrome-tick";
/** D-006: driver tab without `alive` for this long ⇒ removed. Ticks are 30 s apart (alarm minimum),
 *  so allow one missed answer (D-016). */
const ALIVE_TIMEOUT_MS = 65_000;
/** D-017: a tab that left the site keeps the presence this long unless another tab takes over.
 *  Checked on the 30 s tick, so it lasts 30–60 s. */
const GONE_GRACE_MS = 30_000;

const conn = createConnection({
    onHello: () => void saveSession({ sent: null }).then(sync),
    onState: connected => {
        void chrome.action.setBadgeText({ text: connected ? "" : "off" });
        void chrome.action.setBadgeBackgroundColor({ color: "#777" });
    },
    onTick: () => void tick()
});

/** Compute the wanted presence and send it if it differs from what was sent. */
async function sync() {
    const [{ enabled }, { candidates, sent }] = await Promise.all([loadState(), loadSession()]);
    const driver = enabled ? pickDriver(Object.values(candidates)) : null;
    const wanted = driver?.presence ?? null;
    conn.setKeepalive(Object.keys(candidates).length > 0);
    if (Object.keys(candidates).length) void chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 });
    else void chrome.alarms.clear(TICK_ALARM);
    if (!conn.isConnected()) return conn.ensure();
    if (samePayload(wanted, sent)) return;
    const ok = wanted ? conn.send({ type: "activity", activity: wanted }) : conn.send({ type: "clear" });
    if (ok) await saveSession({ sent: wanted });
}

async function remove(tabId: number) {
    let had = false;
    await updateCandidates(c => {
        had = String(tabId) in c;
        delete c[tabId];
    });
    if (had) await sync();
}

/** Tab left the site: keep its presence as a fallback for GONE_GRACE_MS (D-017). */
async function leave(tabId: number) {
    let had = false;
    await updateCandidates(c => {
        const cur = c[tabId];
        if (!cur || cur.goneAt) return;
        had = true;
        cur.goneAt = Date.now();
        cur.playing = false;
    });
    if (had) await sync();
}

/** Drop expired gone tabs, ping the driver tab, drop it if silent (D-006). */
async function tick() {
    conn.ensure();
    const now = Date.now();
    let expired = false;
    await updateCandidates(c => {
        for (const [id, cand] of Object.entries(c))
            if (cand.goneAt && now - cand.goneAt >= GONE_GRACE_MS) {
                delete c[Number(id)];
                expired = true;
            }
    });
    if (expired) await sync();
    const { candidates } = await loadSession();
    const driver = pickDriver(Object.values(candidates));
    if (!driver || driver.goneAt) return;
    if (Date.now() - driver.aliveAt > ALIVE_TIMEOUT_MS) return remove(driver.tabId);
    // The content script answers through sendResponse, not runtime.sendMessage: record it here.
    const tab = { id: driver.tabId } as chrome.tabs.Tab;
    chrome.tabs
        .sendMessage(driver.tabId, { type: "ping" } satisfies WorkerToContent)
        .then(
            (r: ContentToWorker | undefined) => (r?.type === "alive" ? onContent(r, tab) : undefined),
            () => remove(driver.tabId)
        );
}

async function onContent(msg: ContentToWorker, tab: chrome.tabs.Tab) {
    const tabId = tab.id!;
    if (msg.type === "gone") return leave(tabId);
    const now = Date.now();
    await updateCandidates(c => {
        const cur = c[tabId];
        if (msg.type === "alive") {
            if (cur) cur.aliveAt = now;
            return;
        }
        const focusedAt = cur?.focusedAt ?? (tab.active ? now : 0);
        c[tabId] = { tabId, ruleId: msg.ruleId, presence: msg.presence, playing: msg.playing, focusedAt, aliveAt: now } satisfies Candidate;
    });
    if (msg.type === "update") await sync();
}

async function status(): Promise<Status> {
    const [{ enabled }, { candidates }] = await Promise.all([loadState(), loadSession()]);
    const driver = enabled ? pickDriver(Object.values(candidates)) : null;
    return {
        type: "status",
        enabled,
        connected: conn.isConnected(),
        presence: driver?.presence ?? null,
        tabId: driver?.tabId ?? null,
        ruleId: driver?.ruleId ?? null
    };
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, sender, sendResponse) => {
    conn.ensure();
    if (sender.tab) {
        if (sender.tab.incognito || sender.tab.id === undefined) return;
        void onContent(msg as ContentToWorker, sender.tab);
        return;
    }
    if (msg.type === "getStatus") {
        void status().then(sendResponse);
        return true;
    }
    if (msg.type === "preview") {
        void (async () => {
            const tabId = msg.tabId ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id;
            if (tabId === undefined) return sendResponse({ type: "previewResult", matched: false, fields: {}, presence: null, error: "No tab" });
            chrome.tabs
                .sendMessage(tabId, { type: "preview", rule: msg.rule } satisfies WorkerToContent)
                .then(sendResponse, (e: Error) => sendResponse({ type: "previewResult", matched: false, fields: {}, presence: null, error: e.message }));
        })();
        return true;
    }
});

const focus = async (tabId: number) => {
    let changed = false;
    await updateCandidates(c => {
        if (c[tabId]) {
            c[tabId].focusedAt = Date.now();
            changed = true;
        }
    });
    if (changed) await sync();
};

chrome.tabs.onActivated.addListener(({ tabId }) => {
    conn.ensure();
    void focus(tabId);
});
chrome.windows.onFocusChanged.addListener(async windowId => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab?.id !== undefined) void focus(tab.id);
});
chrome.tabs.onRemoved.addListener(tabId => void leave(tabId));
// Navigation to a site without rule: the content script exits silently (D-008), so check here.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
    if (!info.url) return;
    const host = URL.canParse(info.url) ? new URL(info.url).hostname : "";
    if (!findRule(await getRules(), host)) void leave(tabId);
});
chrome.alarms.onAlarm.addListener(a => {
    if (a.name === RECONNECT_ALARM) conn.ensure(true);
    else if (a.name === TICK_ALARM) void tick();
});
onStateChange(() => void sync());

// Worker (re)start: connect and restore.
void chrome.action.setBadgeText({ text: "off" });
conn.ensure(true);
void sync();
