import type { DomMedia, MediaSnapshot } from "./types.ts";

/** Media snapshot from DOM elements (D-014); undefined when the progress element is missing or unreadable. */
export function domMediaSnapshot(cfg: DomMedia | undefined, doc: Document, session: MediaSnapshot["session"]): MediaSnapshot | undefined {
    if (!cfg) return undefined;
    try {
        const el = doc.querySelector(cfg.progressSelector);
        if (!el) return undefined;
        const currentTime = parseFloat(el.getAttribute(cfg.currentAttr) ?? "");
        const duration = parseFloat(el.getAttribute(cfg.maxAttr) ?? "");
        if (!Number.isFinite(currentTime)) return undefined;
        return { paused: !!doc.querySelector(cfg.pausedSelector), currentTime, duration: duration > 0 ? duration : NaN, live: false, session };
    } catch {
        return undefined;
    }
}
