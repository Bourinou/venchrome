// Shared message protocol (D-003). No Vencord imports: also imported by the extension.

export const PROTOCOL_VERSION = 1;
export const PORT = 28463;
export const HOST = "127.0.0.1";

export type ActivityType = 0 | 2 | 3; // playing | listening | watching

export interface PresenceButton {
    label: string;
    url: string;
}

export interface PresencePayload {
    name: string;
    type: ActivityType;
    details?: string;
    state?: string;
    largeImage?: string;
    largeText?: string;
    smallImage?: string;
    smallText?: string;
    /** ms epoch */
    startTimestamp?: number;
    /** ms epoch */
    endTimestamp?: number;
    /** max 2 */
    buttons?: PresenceButton[];
}

export type ClientMessage =
    | { v: 1; type: "activity"; activity: PresencePayload }
    | { v: 1; type: "clear" }
    | { v: 1; type: "ping" };

export type ServerMessage =
    | { v: 1; type: "hello" }
    | { v: 1; type: "pong" };
