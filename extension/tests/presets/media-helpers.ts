import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { domMediaSnapshot } from "../../src/rules/dommedia.ts";
import { extractFields } from "../../src/rules/extract.ts";
import { pickPage } from "../../src/rules/match.ts";
import { buildPresence } from "../../src/rules/presence.ts";
import type { MediaSnapshot, Rule } from "../../src/rules/types.ts";

export const NOW = 1_000_000_000_000;
type Session = MediaSnapshot["session"];

export const readSession = (site: string): NonNullable<Session> =>
    JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures", site, "mediasession.json"), "utf8"));

/** Mirrors the content script: DOM media snapshot (D-014), fields, page, payload. */
export function runFixture(rule: Rule, site: string, name: string, url: string, session?: Session) {
    const doc = document.implementation.createHTMLDocument("t");
    doc.body.innerHTML = readFileSync(resolve(process.cwd(), "tests/fixtures", site, `${name}.html`), "utf8");
    const snap =
        domMediaSnapshot(rule.domMedia, doc, session) ??
        (session ? { paused: true, currentTime: 0, duration: NaN, live: false, session } : undefined);
    const fields = extractFields(rule, doc, url, snap);
    return buildPresence(rule, pickPage(rule, new URL(url).pathname, fields), fields, snap, NOW);
}
