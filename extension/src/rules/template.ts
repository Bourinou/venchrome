import type { Fields } from "./types.ts";

export const MAX_LEN = 128;

/**
 * `{field}` is replaced by the field value; `{a|b}` uses the first non-empty one.
 * Returns undefined when the result is empty (line omitted). Truncated to 128 chars.
 */
export function renderTemplate(tpl: string | undefined, fields: Fields): string | undefined {
    if (!tpl) return undefined;
    const out = tpl
        .replace(/\{([^{}]+)\}/g, (_, keys: string) =>
            keys.split("|").map(k => fields[k.trim()] ?? "").find(v => v !== "") ?? "")
        .replace(/\s+/g, " ")
        .trim();
    if (!out) return undefined;
    return out.length > MAX_LEN ? out.slice(0, MAX_LEN - 1) + "…" : out;
}
