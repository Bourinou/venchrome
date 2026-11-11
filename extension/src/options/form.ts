// Pure conversion between the editor's string-only form model and a Rule, plus validation.
import type { ActivityType } from "../../../plugin/venchrome/protocol.ts";
import type { DomMedia, FieldCondition, FieldSource, Rule, RulePage } from "../rules/types.ts";

export type SourceKind = FieldSource["from"];
export const SOURCE_KINDS: SourceKind[] = ["selector", "meta", "title", "url", "mediaSession"];
export const MEDIA_KEYS = ["title", "artist", "album", "artwork"] as const;

/** p1/p2 meaning per kind: selector = selector/attr, meta = name, title|url = regex/group, mediaSession = key. */
export interface FieldForm { name: string; from: SourceKind; p1: string; p2: string }
export interface CondForm { field: string; exists: "" | "true" | "false"; matches: string }
export interface PageForm {
    path: string;
    when: CondForm[];
    details: string;
    state: string;
    largeImage: string;
    largeText: string;
    buttonLabel: string;
    buttonUrl: string;
    media: boolean;
}
export interface RuleForm {
    id: string;
    name: string;
    enabled: boolean;
    hosts: string; // one per line
    activityType: string; // "0" | "2" | "3"
    logo: string;
    fields: FieldForm[];
    domMedia: { pausedSelector: string; progressSelector: string; currentAttr: string; maxAttr: string } | null;
    pages: PageForm[];
}

const opt = <K extends string>(k: K, v: string): { [P in K]?: string } => (v ? ({ [k]: v } as { [P in K]: string }) : {});

function fieldToForm(name: string, s: FieldSource): FieldForm {
    switch (s.from) {
        case "selector": return { name, from: "selector", p1: s.selector, p2: s.attr ?? "" };
        case "meta": return { name, from: "meta", p1: s.name, p2: "" };
        case "title": case "url": return { name, from: s.from, p1: s.regex, p2: s.group === undefined ? "" : String(s.group) };
        case "mediaSession": return { name, from: "mediaSession", p1: s.key, p2: "" };
    }
}

function fieldFromForm(f: FieldForm): FieldSource {
    switch (f.from) {
        case "selector": return { from: "selector", selector: f.p1, ...opt("attr", f.p2) };
        case "meta": return { from: "meta", name: f.p1 };
        case "title": case "url": return { from: f.from, regex: f.p1, ...(f.p2 === "" ? {} : { group: Number(f.p2) }) };
        case "mediaSession": return { from: "mediaSession", key: f.p1 as (typeof MEDIA_KEYS)[number] };
    }
}

function condToForm(c: FieldCondition): CondForm {
    return { field: c.field, exists: c.exists === undefined ? "" : c.exists ? "true" : "false", matches: c.matches ?? "" };
}

function condFromForm(c: CondForm): FieldCondition {
    return { field: c.field, ...(c.exists === "" ? {} : { exists: c.exists === "true" }), ...opt("matches", c.matches) };
}

export function pageToForm(p: RulePage): PageForm {
    return {
        path: p.path ?? "",
        when: (p.when ?? []).map(condToForm),
        details: p.details ?? "",
        state: p.state ?? "",
        largeImage: p.largeImage ?? "",
        largeText: p.largeText ?? "",
        buttonLabel: p.button?.label ?? "",
        buttonUrl: p.button?.url ?? "",
        media: p.media ?? false
    };
}

export function pageFromForm(p: PageForm): RulePage {
    return {
        ...opt("path", p.path),
        ...(p.when.length ? { when: p.when.map(condFromForm) } : {}),
        ...opt("details", p.details),
        ...opt("state", p.state),
        ...opt("largeImage", p.largeImage),
        ...opt("largeText", p.largeText),
        ...(p.buttonLabel || p.buttonUrl ? { button: { label: p.buttonLabel, url: p.buttonUrl } } : {}),
        ...(p.media ? { media: true } : {})
    };
}

export function ruleToForm(r: Rule): RuleForm {
    return {
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        hosts: r.hosts.join("\n"),
        activityType: String(r.activityType),
        logo: r.logo ?? "",
        fields: Object.entries(r.fields).map(([n, s]) => fieldToForm(n, s)),
        domMedia: r.domMedia ? { ...r.domMedia } : null,
        pages: r.pages.map(pageToForm)
    };
}

export function ruleFromForm(f: RuleForm): Rule {
    const fields: Record<string, FieldSource> = {};
    for (const x of f.fields) fields[x.name] = fieldFromForm(x);
    return {
        id: f.id,
        name: f.name,
        enabled: f.enabled,
        hosts: f.hosts.split("\n").map(h => h.trim()).filter(Boolean),
        activityType: Number(f.activityType) as ActivityType,
        ...opt("logo", f.logo),
        fields,
        ...(f.domMedia ? { domMedia: { ...f.domMedia } as DomMedia } : {}),
        pages: f.pages.map(pageFromForm)
    };
}

/** Prefilled rule for a typed domain (D-009: `details` = `{title}`). */
export function newRuleForm(domain: string, existingIds: string[]): RuleForm {
    const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const base = host.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
    let id = base;
    for (let i = 2; existingIds.includes(id); i++) id = `${base}-${i}`;
    return {
        id, name: host || "Custom", enabled: true, hosts: host, activityType: "0", logo: "", fields: [], domMedia: null,
        pages: [{ path: "", when: [], details: "{title}", state: "", largeImage: "", largeText: "", buttonLabel: "", buttonUrl: "", media: false }]
    };
}

const badRegex = (s: string) => {
    try { new RegExp(s); return false; } catch { return true; }
};
const isHttps = (s: string) => /^https:\/\//i.test(s);
/** A template may start with a placeholder; otherwise it must be an https URL. */
const httpsOrTemplate = (s: string) => isHttps(s) || s.startsWith("{");

/** Human-readable problems; empty = valid. */
export function validateForm(f: RuleForm): string[] {
    const e: string[] = [];
    if (!f.name.trim()) e.push("Name is empty.");
    const hosts = f.hosts.split("\n").map(h => h.trim()).filter(Boolean);
    if (!hosts.length) e.push("Add at least one host.");
    if (f.logo && !isHttps(f.logo)) e.push("Logo must be an https URL.");
    const names = new Set<string>();
    for (const x of f.fields) {
        const n = x.name.trim();
        if (!n) e.push("A field has no name.");
        else if (names.has(n)) e.push(`Duplicate field "${n}".`);
        names.add(n);
        if (!x.p1) e.push(`Field "${n}": source value is empty.`);
        else if ((x.from === "title" || x.from === "url") && badRegex(x.p1)) e.push(`Field "${n}": invalid regex.`);
        if ((x.from === "title" || x.from === "url") && x.p2 !== "" && !/^\d+$/.test(x.p2))
            e.push(`Field "${n}": group must be a number.`);
        if (x.from === "mediaSession" && !(MEDIA_KEYS as readonly string[]).includes(x.p1))
            e.push(`Field "${n}": unknown media key.`);
    }
    if (f.domMedia) {
        const d = f.domMedia;
        if (!d.pausedSelector || !d.progressSelector || !d.currentAttr || !d.maxAttr) e.push("DOM media: fill all four values.");
    }
    if (!f.pages.length) e.push("Add at least one page.");
    f.pages.forEach((p, i) => {
        const at = `Page ${i + 1}`;
        if (p.path && badRegex(p.path)) e.push(`${at}: invalid path regex.`);
        for (const c of p.when) {
            if (!c.field) e.push(`${at}: a condition has no field.`);
            if (c.matches && badRegex(c.matches)) e.push(`${at}: invalid condition regex.`);
            if (c.exists === "" && !c.matches) e.push(`${at}: a condition has no test.`);
        }
        if (!!p.buttonLabel !== !!p.buttonUrl) e.push(`${at}: button needs both label and URL.`);
        if (p.buttonUrl && !httpsOrTemplate(p.buttonUrl)) e.push(`${at}: button URL must be https.`);
    });
    return e;
}
