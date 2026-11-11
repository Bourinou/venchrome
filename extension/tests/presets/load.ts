import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractFields } from "../../src/rules/extract.ts";
import { pickPage } from "../../src/rules/match.ts";
import { buildPresence } from "../../src/rules/presence.ts";
import type { MediaSnapshot, Rule } from "../../src/rules/types.ts";

export const NOW = 1_000_000_000;

/** Presence built by `rule` for fixture `site/name.html` served at `url`. */
export function presenceFor(rule: Rule, fixture: string, url: string, media?: MediaSnapshot) {
    const html = readFileSync(resolve(__dirname, "../fixtures", fixture), "utf8");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const fields = extractFields(rule, doc, url, media);
    return buildPresence(rule, pickPage(rule, new URL(url).pathname, fields), fields, media, NOW);
}

export const playing = (currentTime: number, duration: number, session?: MediaSnapshot["session"]): MediaSnapshot =>
    ({ paused: false, currentTime, duration, live: duration === Infinity, session });
