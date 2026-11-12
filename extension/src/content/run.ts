// Content script core, generic: rule → observe → extract → buildPresence → notify the worker on change.
// No chrome.* here: index.ts injects `send`, so this runs under happy-dom in tests.
import type { PresencePayload } from "../../../plugin/venchrome/protocol.ts";
import type { ContentToWorker, PreviewResult } from "../messages.ts";
import { domMediaSnapshot } from "../rules/dommedia.ts";
import { extractFields } from "../rules/extract.ts";
import { findRule, pickPage, ruleMatchesHost } from "../rules/match.ts";
import { buildPresence } from "../rules/presence.ts";
import type { MediaSnapshot, Rule } from "../rules/types.ts";
import { EV_MEDIA_SESSION, EV_MEDIA_SESSION_GET, EV_URL_CHANGE } from "./events.ts";

export const DEBOUNCE_MS = 500;
/** Timestamps drift by less than this are not a change (pitfall: no update per playback tick). */
const TS_TOLERANCE_MS = 2000;
const MEDIA_EVENTS = ["play", "pause", "seeked", "ratechange", "durationchange", "ended"];

/** Playing <video>/<audio>, otherwise the longest one. */
export function pickMediaElement(doc: Document): HTMLMediaElement | undefined {
    const all = [...doc.querySelectorAll<HTMLMediaElement>("video, audio")];
    const dur = (m: HTMLMediaElement) => (Number.isFinite(m.duration) ? m.duration : m.duration === Infinity ? 1e9 : 0);
    return all.find(m => !m.paused && !m.ended) ?? all.sort((a, b) => dur(b) - dur(a))[0];
}

export function mediaSnapshot(el: HTMLMediaElement | undefined, session: MediaSnapshot["session"]): MediaSnapshot | undefined {
    if (!el) return session ? { paused: true, currentTime: 0, duration: NaN, live: false, session } : undefined;
    return { paused: el.paused || el.ended, currentTime: el.currentTime, duration: el.duration, live: el.duration === Infinity, session };
}

/** Equal, ignoring start/end timestamp drift under the tolerance. */
export function samePresence(a: PresencePayload | null, b: PresencePayload | null): boolean {
    if (!a || !b) return a === b;
    const { startTimestamp: as, endTimestamp: ae, ...ra } = a;
    const { startTimestamp: bs, endTimestamp: be, ...rb } = b;
    const near = (x?: number, y?: number) => (x === undefined || y === undefined ? x === y : Math.abs(x - y) <= TS_TOLERANCE_MS);
    return JSON.stringify(ra) === JSON.stringify(rb) && near(as, bs) && near(ae, be);
}

export interface ContentRunner {
    /** New rules / global flag (startup, storage change). */
    setRules(rules: Rule[], enabled: boolean): void;
    /** Worker → content messages; returns the synchronous answer, if any. */
    handle(msg: unknown): PreviewResult | { type: "alive" } | undefined;
    /** Recompute now (skips the debounce). */
    flush(): void;
    stop(): void;
}

export function createRunner(win: Window, send: (m: ContentToWorker) => void): ContentRunner {
    const doc = win.document;
    let rule: Rule | undefined;
    let last: PresencePayload | null = null;
    let lastPlaying = false;
    let session: MediaSnapshot["session"];
    let media: HTMLMediaElement | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastUrl = win.location.href;
    let stopped = false;
    /** Page start (reset on URL change): fixed start when there is no media timing. */
    let sinceUrl = "";
    let since = 0;
    const observer = new MutationObserver(() => schedule());

    const schedule = () => {
        if (stopped || !rule) return;
        clearTimeout(timer);
        timer = setTimeout(recompute, DEBOUNCE_MS);
    };

    const onSession = (e: Event) => {
        try {
            session = JSON.parse(String((e as CustomEvent).detail)) ?? undefined;
        } catch {
            session = undefined;
        }
    };
    const requestSession = () => doc.dispatchEvent(new CustomEvent(EV_MEDIA_SESSION_GET));
    const onSessionChange = (e: Event) => {
        onSession(e);
        schedule();
    };
    const onVisible = () => {
        if (doc.visibilityState === "visible") schedule();
    };
    const onPageHide = () => {
        if (last) safeSend({ type: "gone" });
        last = null;
    };

    function safeSend(m: ContentToWorker) {
        try {
            send(m);
        } catch {
            // Extension reloaded: "context invalidated". Stop quietly.
            stop();
        }
    }

    function bindMedia() {
        const el = pickMediaElement(doc);
        if (el === media) return;
        for (const ev of MEDIA_EVENTS) media?.removeEventListener(ev, schedule);
        media = el;
        for (const ev of MEDIA_EVENTS) media?.addEventListener(ev, schedule);
    }

    /** Targeted observation: <title> and the parents of the rule's selector fields (body childList when not found yet). */
    function bindObserver() {
        observer.disconnect();
        if (!rule) return;
        const title = doc.querySelector("title");
        if (title) observer.observe(title, { childList: true, characterData: true, subtree: true });
        else if (doc.head) observer.observe(doc.head, { childList: true });
        let missing = false;
        for (const src of Object.values(rule.fields)) {
            if (src.from !== "selector") continue;
            let el: Element | null = null;
            try {
                el = doc.querySelector(src.selector);
            } catch { /* invalid selector: nothing to watch */ }
            if (el?.parentElement) observer.observe(el.parentElement, { childList: true, characterData: true, subtree: true, attributes: !!src.attr });
            else missing = true;
        }
        // Media elements and missing fields can appear anywhere.
        if (doc.body) observer.observe(doc.body, { childList: true, subtree: missing || !media });
    }

    function evaluate(r: Rule) {
        requestSession();
        const href = win.location.href;
        if (href !== sinceUrl) {
            sinceUrl = href;
            since = Date.now();
        }
        const snap = (!media && domMediaSnapshot(r.domMedia, doc, session)) || mediaSnapshot(media, session);
        const fields = extractFields(r, doc, href, snap);
        const page = pickPage(r, win.location.pathname, fields);
        return { fields, page, snap, presence: buildPresence(r, page, fields, snap, Date.now(), since) };
    }

    function recompute() {
        clearTimeout(timer);
        if (stopped || !rule) return;
        lastUrl = win.location.href;
        bindMedia();
        const { presence, snap } = evaluate(rule);
        bindObserver();
        if (!presence) {
            if (last) safeSend({ type: "gone" });
            last = null;
            return;
        }
        const playing = !!snap && !snap.paused;
        if (samePresence(last, presence) && playing === lastPlaying) return;
        last = presence;
        lastPlaying = playing;
        safeSend({ type: "update", ruleId: rule.id, presence, playing });
    }

    const onUrlMaybeChanged = () => {
        if (win.location.href !== lastUrl) schedule();
    };
    const onUrlChange = () => schedule();

    function listen(on: boolean) {
        const m = on ? "addEventListener" : "removeEventListener";
        doc[m](EV_MEDIA_SESSION, onSessionChange);
        doc[m](EV_URL_CHANGE, onUrlChange);
        doc[m]("visibilitychange", onVisible);
        win[m]("popstate", onUrlChange);
        win[m]("hashchange", onUrlMaybeChanged);
        win[m]("pagehide", onPageHide);
    }

    function setRules(rules: Rule[], enabled: boolean) {
        if (stopped) return;
        const next = enabled ? findRule(rules, win.location.hostname) : undefined;
        if (!next) {
            if (rule) {
                listen(false);
                observer.disconnect();
                for (const ev of MEDIA_EVENTS) media?.removeEventListener(ev, schedule);
                media = undefined;
                clearTimeout(timer);
            }
            rule = undefined;
            onPageHide();
            return;
        }
        if (!rule) listen(true);
        rule = next;
        last = null; // rule may have changed: resend
        recompute();
    }

    function handle(msg: unknown) {
        const m = msg as { type?: string; rule?: Rule };
        if (m?.type === "ping") return { type: "alive" as const };
        if (m?.type === "preview" && m.rule) return preview(m.rule);
        return undefined;
    }

    function preview(r: Rule): PreviewResult {
        const matched = ruleMatchesHost(r, win.location.hostname);
        try {
            if (!media) media = pickMediaElement(doc);
            const { fields, presence } = evaluate(r);
            return { type: "previewResult", matched, fields, presence };
        } catch (e) {
            return { type: "previewResult", matched, fields: {}, presence: null, error: String(e) };
        }
    }

    function stop() {
        if (stopped) return;
        last = null; // no "gone": sending is what failed
        setRules([], false);
        stopped = true;
    }

    doc.addEventListener(EV_MEDIA_SESSION, onSession);
    return { setRules, handle, flush: recompute, stop };
}
