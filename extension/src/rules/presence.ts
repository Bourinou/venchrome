import type { PresencePayload } from "../../../plugin/venchrome/protocol.ts";
import { renderTemplate } from "./template.ts";
import type { Fields, MediaSnapshot, Rule, RulePage } from "./types.ts";

/** Seconds → "m:ss" / "h:mm:ss"; "" when not a finite positive number. */
export function clock(sec: number): string {
    if (!Number.isFinite(sec) || sec <= 0) return "";
    const s = Math.floor(sec);
    const pad = (n: number) => String(n).padStart(2, "0");
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

const isHttpUrl =(s: string | undefined): s is string => !!s && /^https?:\/\//i.test(s);

/**
 * Payload for Discord, or null when there is no page.
 * Media (only if `page.media` and a snapshot is given): playing → start/end timestamps
 * (start only if live or duration unknown); paused → no timestamps, smallImage "pause" (D-006).
 * The logo is the large image, or the small one when the page has its own large image (thumbnail).
 */
export function buildPresence(
    rule: Rule,
    page: RulePage | undefined,
    fields: Fields,
    media?: MediaSnapshot,
    now = Date.now(),
    since?: number
): PresencePayload | null {
    if (!page) return null;
    const p: PresencePayload = { name: rule.name, type: rule.activityType };
    const set = <K extends keyof PresencePayload>(k: K, v: PresencePayload[K] | undefined) => {
        if (v !== undefined) p[k] = v;
    };
    set("details", renderTemplate(page.details, fields));
    set("state", renderTemplate(page.state, fields));
    set("largeText", renderTemplate(page.largeText, fields));

    const thumb = renderTemplate(page.largeImage, fields);
    if (thumb) {
        p.largeImage = thumb;
        set("smallImage", rule.logo);
        set("smallText", rule.logo && rule.name);
    } else {
        set("largeImage", rule.logo);
    }

    if (page.media && media) {
        if (media.paused) {
            p.smallImage = "pause";
            const pos = clock(media.currentTime);
            const dur = clock(media.duration);
            p.smallText = pos ? `Paused at ${pos}${dur ? ` / ${dur}` : ""}` : "Paused";
        } else {
            const pos = Number.isFinite(media.currentTime) ? media.currentTime : 0;
            p.startTimestamp = Math.round(now - pos * 1000);
            if (!media.live && Number.isFinite(media.duration) && media.duration > 0)
                p.endTimestamp = Math.round(p.startTimestamp + media.duration * 1000);
        }
    }

    // No media timing: a fixed start, else Discord shows a timer reset on every update (D-016).
    // Paused: no timer at all, just the pause icon (D-018).
    if (!p.startTimestamp && since && !(page.media && media?.paused)) p.startTimestamp = since;

    if (page.button) {
        const label = renderTemplate(page.button.label, fields);
        const url = renderTemplate(page.button.url, fields);
        if (label && isHttpUrl(url)) p.buttons = [{ label, url }];
    }
    return p;
}
