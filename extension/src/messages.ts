// Internal messages (chrome.runtime / chrome.tabs messaging). Frozen after S004: S005 and S006 build on it.
import type { PresencePayload } from "../../plugin/venchrome/protocol.ts";
import type { Fields, Rule } from "./rules/types.ts";

/** Content script → worker. */
export type ContentToWorker =
    /** Current presence of this tab; `playing` = a media is playing (D-005 driver choice). */
    | { type: "update"; ruleId: string; presence: PresencePayload; playing: boolean }
    /** This tab no longer matches a rule (navigated away / no page). */
    | { type: "gone" }
    /** Answer to `ping` (D-006: 30 s without answer ⇒ clear). */
    | { type: "alive" };

/** Worker → content script (chrome.tabs.sendMessage). */
export type WorkerToContent =
    | { type: "ping" }
    /** Evaluate `rule` on this tab without sending it to Discord; answered with `previewResult`. */
    | { type: "preview"; rule: Rule };

/** Content script answer to `preview` (sendResponse). */
export interface PreviewResult {
    type: "previewResult";
    /** False when the tab hostname does not match the rule. */
    matched: boolean;
    fields: Fields;
    presence: PresencePayload | null;
    error?: string;
}

/** Options / popup → worker. */
export type UiToWorker =
    /** Preview `rule` on `tabId` (default: active tab). Answered with PreviewResult. */
    | { type: "preview"; rule: Rule; tabId?: number }
    | { type: "getStatus" };

/** Worker answer to `getStatus`. */
export interface Status {
    type: "status";
    enabled: boolean;
    /** WebSocket to the Vencord plugin is open. */
    connected: boolean;
    presence: PresencePayload | null;
    tabId: number | null;
    ruleId: string | null;
}

export type RuntimeMessage = ContentToWorker | UiToWorker;
