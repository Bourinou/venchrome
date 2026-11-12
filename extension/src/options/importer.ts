// JSON import/export of custom rules (D-020). Data only: input is rebuilt field by field, never evaluated.
import type { DomMedia, FieldCondition, FieldSource, Rule, RulePage } from "../rules/types.ts";
import { MEDIA_KEYS, ruleToForm, validateForm } from "./form.ts";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";

/** Optional string props copied if present; wrong type => error. */
function strings(o: Obj, keys: string[], at: string, errs: string[]): Obj {
    const out: Obj = {};
    for (const k of keys) {
        if (o[k] === undefined) continue;
        if (isStr(o[k])) out[k] = o[k];
        else errs.push(`${at}: "${k}" must be a string.`);
    }
    return out;
}

function toSource(v: unknown, at: string, errs: string[]): FieldSource | null {
    if (!isObj(v)) { errs.push(`${at}: must be an object.`); return null; }
    const need = (k: string) => (isStr(v[k]) ? true : (errs.push(`${at}: "${k}" must be a string.`), false));
    const group = () => {
        if (v.group === undefined) return {};
        if (typeof v.group === "number" && Number.isInteger(v.group) && v.group >= 0) return { group: v.group };
        errs.push(`${at}: "group" must be a whole number.`);
        return {};
    };
    switch (v.from) {
        case "selector": return need("selector") ? { from: "selector", selector: v.selector as string, ...strings(v, ["attr"], at, errs) } : null;
        case "meta": return need("name") ? { from: "meta", name: v.name as string } : null;
        case "title": case "url": return need("regex") ? { from: v.from, regex: v.regex as string, ...group() } : null;
        case "mediaSession":
            if (isStr(v.key) && (MEDIA_KEYS as readonly string[]).includes(v.key)) return { from: "mediaSession", key: v.key as (typeof MEDIA_KEYS)[number] };
            errs.push(`${at}: "key" must be one of ${MEDIA_KEYS.join(", ")}.`);
            return null;
        default:
            errs.push(`${at}: "from" must be selector, meta, title, url or mediaSession.`);
            return null;
    }
}

function toPage(v: unknown, at: string, errs: string[]): RulePage | null {
    if (!isObj(v)) { errs.push(`${at}: must be an object.`); return null; }
    const page: RulePage = strings(v, ["path", "details", "state", "largeImage", "largeText"], at, errs);
    if (v.when !== undefined) {
        if (!Array.isArray(v.when)) errs.push(`${at}: "when" must be an array.`);
        else page.when = v.when.flatMap((c, i): FieldCondition[] => {
            if (!isObj(c) || !isStr(c.field)) { errs.push(`${at}.when[${i}]: needs a "field" string.`); return []; }
            if (c.exists !== undefined && typeof c.exists !== "boolean") errs.push(`${at}.when[${i}]: "exists" must be true or false.`);
            return [{ field: c.field, ...(typeof c.exists === "boolean" ? { exists: c.exists } : {}), ...strings(c, ["matches"], `${at}.when[${i}]`, errs) }];
        });
    }
    if (v.button !== undefined) {
        if (isObj(v.button) && isStr(v.button.label) && isStr(v.button.url)) page.button = { label: v.button.label, url: v.button.url };
        else errs.push(`${at}: "button" needs "label" and "url" strings.`);
    }
    if (v.media !== undefined) {
        if (typeof v.media === "boolean") { if (v.media) page.media = true; } else errs.push(`${at}: "media" must be true or false.`);
    }
    return page;
}

/** Rebuilds a clean Rule from untrusted data. Problems are pushed to `errs`. */
function toRule(v: unknown, at: string, errs: string[]): Rule | null {
    if (!isObj(v)) { errs.push(`${at}: must be an object.`); return null; }
    const n0 = errs.length;
    if (!isStr(v.id) || !v.id.trim()) errs.push(`${at}: "id" must be a non-empty string.`);
    if (!isStr(v.name)) errs.push(`${at}: "name" must be a string.`);
    if (!Array.isArray(v.hosts) || !v.hosts.every(isStr)) errs.push(`${at}: "hosts" must be an array of strings.`);
    if (v.activityType !== 0 && v.activityType !== 2 && v.activityType !== 3) errs.push(`${at}: "activityType" must be 0 (playing), 2 (listening) or 3 (watching).`);
    if (v.enabled !== undefined && typeof v.enabled !== "boolean") errs.push(`${at}: "enabled" must be true or false.`);
    const logo = strings(v, ["logo"], at, errs);
    const fields: Record<string, FieldSource> = {};
    if (v.fields !== undefined && !isObj(v.fields)) errs.push(`${at}: "fields" must be an object.`);
    else for (const [k, s] of Object.entries(v.fields ?? {})) {
        const src = toSource(s, `${at}.fields.${k}`, errs);
        if (src) fields[k] = src;
    }
    let domMedia: DomMedia | undefined;
    if (v.domMedia !== undefined) {
        const d = v.domMedia;
        if (isObj(d) && ["pausedSelector", "progressSelector", "currentAttr", "maxAttr"].every(k => isStr(d[k])))
            domMedia = { pausedSelector: d.pausedSelector as string, progressSelector: d.progressSelector as string, currentAttr: d.currentAttr as string, maxAttr: d.maxAttr as string };
        else errs.push(`${at}: "domMedia" needs pausedSelector, progressSelector, currentAttr and maxAttr strings.`);
    }
    const pages: RulePage[] = [];
    if (!Array.isArray(v.pages)) errs.push(`${at}: "pages" must be an array.`);
    else v.pages.forEach((p, i) => { const pg = toPage(p, `${at}.pages[${i}]`, errs); if (pg) pages.push(pg); });
    if (errs.length > n0) return null;
    return {
        id: (v.id as string).trim(), name: v.name as string, enabled: v.enabled !== false,
        hosts: v.hosts as string[], activityType: v.activityType as Rule["activityType"],
        ...logo, fields, ...(domMedia ? { domMedia } : {}), pages
    };
}

export interface ImportResult { rules: Rule[]; errors: string[] }

/**
 * Parses pasted JSON (one rule or an array). All-or-nothing: any error => `rules` is empty.
 * `takenIds` = ids already in use (presets and custom rules): they are refused, never overwritten.
 */
export function parseImport(text: string, takenIds: Iterable<string>): ImportResult {
    let data: unknown;
    try { data = JSON.parse(text); } catch (e) { return { rules: [], errors: [`Not valid JSON: ${(e as Error).message}`] }; }
    const list = Array.isArray(data) ? data : [data];
    if (!list.length) return { rules: [], errors: ["The array is empty."] };
    const errors: string[] = [];
    const taken = new Set(takenIds);
    const rules: Rule[] = [];
    list.forEach((item, i) => {
        const at = Array.isArray(data) ? `Rule ${i + 1}` : "Rule";
        const r = toRule(item, at, errors);
        if (!r) return;
        if (taken.has(r.id)) errors.push(`${at}: id "${r.id}" is already used. Change the id, or edit/delete the existing rule first.`);
        taken.add(r.id);
        for (const e of validateForm(ruleToForm(r))) errors.push(`${at} ("${r.id}"): ${e}`);
        rules.push(r);
    });
    return errors.length ? { rules: [], errors } : { rules, errors };
}

/** Pretty JSON of one rule, or of an array when given several. */
export const exportRules = (rules: Rule[]): string => JSON.stringify(rules.length === 1 ? rules[0] : rules, null, 2);
