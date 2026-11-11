// MV3 service worker: picks the driving tab, keeps the WS to the plugin, sends only changes.
import type { ContentToWorker, RuntimeMessage, Status, WorkerToContent } from "../messages.ts";
import { findRule } from "../rules/match.ts";
import { getRules, loadState, onStateChange } from "../storage.ts";
import { pickDriver, samePayload, type Candidate } from "./arbiter.ts";
import { createConnection, RECONNECT_ALARM } from "./connection.ts";
import { loadSession, saveSession, updateCandidates } from "./state.ts";

const TICK_ALARM = "venchrome-tick";
/** D-006: driver tab without `alive` for this long ⇒ removed. */
const ALIVE_TIMEOUT_MS = 30_000;

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

/** Ping the driver tab, drop it if silent for 30 s (D-006). */
async function tick() {
    conn.ensure();
    const { candidates } = await loadSession();
    const driver = pickDriver(Object.values(candidates));
    if (!driver) return;
    if (Date.now() - driver.aliveAt > ALIVE_TIMEOUT_MS) return remove(driver.tabId);
    chrome.tabs.sendMessage(driver.tabId, { type: "ping" } satisfies WorkerToContent).catch(() => remove(driver.tabId));
}

async function onContent(msg: ContentToWorker, tab: chrome.tabs.Tab) {
    const tabId = tab.id!;
    if (msg.type === "gone") return remove(tabId);
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
chrome.tabs.onRemoved.addListener(tabId => void remove(tabId));
// Navigation to a site without rule: the content script exits silently (D-008), so check here.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
    if (!info.url) return;
    const host = URL.canParse(info.url) ? new URL(info.url).hostname : "";
    if (!findRule(await getRules(), host)) void remove(tabId);
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
