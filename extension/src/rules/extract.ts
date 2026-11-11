import type { FieldSource, Fields, MediaSnapshot, Rule } from "./types.ts";

function regexGroup(src: string, input: string, group = 1): string {
    try {
        return new RegExp(src).exec(input)?.[group] ?? "";
    } catch {
        return "";
    }
}

function clean(s: string | null | undefined): string {
    return (s ?? "").replace(/\s+/g, " ").trim();
}

export function extractField(src: FieldSource, doc: Document, url: string, media?: MediaSnapshot): string {
    switch (src.from) {
        case "selector": {
            let el: Element | null = null;
            try {
                el = doc.querySelector(src.selector);
            } catch {
                return "";
            }
            if (!el) return "";
            return clean(src.attr ? el.getAttribute(src.attr) : el.textContent);
        }
        case "meta": {
            const n = CSS.escape(src.name);
            return clean(doc.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute("content"));
        }
        case "title":
            return clean(regexGroup(src.regex, doc.title, src.group));
        case "url":
            return clean(regexGroup(src.regex, url, src.group));
        case "mediaSession":
            return clean(media?.session?.[src.key]);
    }
}

/**
 * All fields of a rule, plus built-ins `url`, `host`, `title`.
 * Media state (paused, currentTime, duration, live) stays in the snapshot, used by buildPresence.
 */
export function extractFields(rule: Rule, doc: Document, url: string, media?: MediaSnapshot): Fields {
    const out: Fields = { url, host: safeHost(url), title: clean(doc.title) };
    for (const [key, src] of Object.entries(rule.fields)) out[key] = extractField(src, doc, url, media);
    return out;
}

function safeHost(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return "";
    }
}
