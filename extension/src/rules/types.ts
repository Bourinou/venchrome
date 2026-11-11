// Site rule schema. Rules are plain data: everything must survive JSON.stringify (no functions).
import type { ActivityType } from "../../../plugin/venchrome/protocol.ts";

/** Where a field value comes from. */
export type FieldSource =
    /** CSS selector; text content by default, or an attribute value. */
    | { from: "selector"; selector: string; attr?: string }
    /** <meta name|property="..."> content. */
    | { from: "meta"; name: string }
    /** Regex on document.title; capture group `group` (default 1). */
    | { from: "title"; regex: string; group?: number }
    /** Regex on the full URL; capture group `group` (default 1). */
    | { from: "url"; regex: string; group?: number }
    /** navigator.mediaSession metadata (read in the MAIN world, passed as a snapshot). */
    | { from: "mediaSession"; key: "title" | "artist" | "album" | "artwork" };

/** Condition on an extracted field: `exists` (non-empty) or `matches` (regex). */
export interface FieldCondition {
    field: string;
    exists?: boolean;
    matches?: string;
}

export interface RuleButton {
    /** Template. */
    label: string;
    /** Template; must render to an http(s) URL or the button is dropped. */
    url: string;
}

export interface RulePage {
    /** Regex tested on location.pathname. Absent = any path. */
    path?: string;
    /** All conditions must pass. */
    when?: FieldCondition[];
    /** Templates: `{field}`, fallback `{a|b}`. Built-in fields: `url`, `host`, `title`. */
    details?: string;
    state?: string;
    largeImage?: string;
    largeText?: string;
    button?: RuleButton;
    /** Use media state (timestamps, pause icon). */
    media?: boolean;
}

export interface Rule {
    id: string;
    /** Activity name shown on Discord. */
    name: string;
    enabled: boolean;
    /** D-008: "anime-sama" = any TLD, "claude.ai" = host or subdomain. */
    hosts: string[];
    activityType: ActivityType;
    /** https URL. */
    logo?: string;
    fields: Record<string, FieldSource>;
    /** Ordered: first page whose `path` and `when` pass wins. */
    pages: RulePage[];
}

/** Media state snapshot, read by the content script (MAIN world for mediaSession). */
export interface MediaSnapshot {
    paused: boolean;
    /** seconds */
    currentTime: number;
    /** seconds; NaN/Infinity when unknown or live */
    duration: number;
    live: boolean;
    session?: { title?: string; artist?: string; album?: string; artwork?: string };
}

export type Fields = Record<string, string>;

/* Example:
const example: Rule = {
    id: "youtube",
    name: "YouTube",
    enabled: true,
    hosts: ["youtube"],
    activityType: 3,
    logo: "https://www.youtube.com/favicon.ico",
    fields: {
        video: { from: "title", regex: "^(?:\\(\\d+\\) )?(.+) - YouTube$" },
        channel: { from: "selector", selector: "#owner #channel-name a" },
        thumb: { from: "meta", name: "og:image" }
    },
    pages: [
        {
            path: "^/watch",
            when: [{ field: "video", exists: true }],
            details: "{video}",
            state: "by {channel}",
            largeImage: "{thumb}",
            largeText: "{video}",
            button: { label: "Watch", url: "{url}" },
            media: true
        },
        { details: "Browsing" }
    ]
};
*/
