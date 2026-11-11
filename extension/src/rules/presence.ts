import type { PresencePayload } from "../../../plugin/venchrome/protocol.ts";
import { renderTemplate } from "./template.ts";
import type { Fields, MediaSnapshot, Rule, RulePage } from "./types.ts";

const isHttpUrl = (s: string | undefined): s is string => !!s && /^https?:\/\//i.test(s);

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
    now = Date.now()
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
            p.smallText = "Paused";
        } else {
            const pos = Number.isFinite(media.currentTime) ? media.currentTime : 0;
            p.startTimestamp = Math.round(now - pos * 1000);
            if (!media.live && Number.isFinite(media.duration) && media.duration > 0)
                p.endTimestamp = Math.round(p.startTimestamp + media.duration * 1000);
        }
    }

    if (page.button) {
        const label = renderTemplate(page.button.label, fields);
        const url = renderTemplate(page.button.url, fields);
        if (label && isHttpUrl(url)) p.buttons = [{ label, url }];
    }
    return p;
}
