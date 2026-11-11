import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { buildPresence } from "../../src/rules/presence.ts";
import { extractFields } from "../../src/rules/extract.ts";
import { pickPage } from "../../src/rules/match.ts";
import type { Rule } from "../../src/rules/types.ts";

/** Presence a rule would send for a fixture HTML file at `url`. */
export function presenceFor(rule: Rule, fixture: string, url: string) {
    const html = readFileSync(resolve(process.cwd(), "tests/fixtures", fixture), "utf8");
    document.documentElement.innerHTML = html.replace(/^<!doctype html>/i, "");
    const fields = extractFields(rule, document, url);
    return buildPresence(rule, pickPage(rule, new URL(url).pathname, fields), fields);
}
