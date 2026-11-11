import type { Fields, FieldCondition, Rule, RulePage } from "./types.ts";

/**
 * D-008. Entry without a dot ("anime-sama"): one hostname label (TLD excluded) equals it.
 * Entry with a dot ("claude.ai"): hostname equals it or is a subdomain of it.
 */
export function matchHost(hostname: string, entry: string): boolean {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    const e = entry.toLowerCase().trim();
    if (!e) return false;
    if (e.includes(".")) return host === e || host.endsWith("." + e);
    return host.split(".").slice(0, -1).includes(e);
}

export function ruleMatchesHost(rule: Rule, hostname: string): boolean {
    return rule.hosts.some(h => matchHost(hostname, h));
}

/** First enabled rule matching the hostname. */
export function findRule(rules: Rule[], hostname: string): Rule | undefined {
    return rules.find(r => r.enabled && ruleMatchesHost(r, hostname));
}

function safeRegex(src: string): RegExp | null {
    try {
        return new RegExp(src);
    } catch {
        return null;
    }
}

function conditionPasses(c: FieldCondition, fields: Fields): boolean {
    const v = fields[c.field] ?? "";
    if (c.exists !== undefined && (v !== "") !== c.exists) return false;
    if (c.matches !== undefined && !safeRegex(c.matches)?.test(v)) return false;
    return true;
}

/** First page whose `path` regex and all `when` conditions pass. */
export function pickPage(rule: Rule, pathname: string, fields: Fields): RulePage | undefined {
    return rule.pages.find(p =>
        (p.path === undefined || !!safeRegex(p.path)?.test(pathname))
        && (p.when ?? []).every(c => conditionPasses(c, fields)));
}
