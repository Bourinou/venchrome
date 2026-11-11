// Validation of incoming client messages. Kept out of native.ts: every native export must take the IPC event.
import { ClientMessage, PROTOCOL_VERSION } from "./protocol";

const ACTIVITY_TYPES = [0, 2, 3];

/** Returns the message if it is a valid v1 client message, else undefined. */
export function parseClientMessage(text: string): ClientMessage | undefined {
    let msg: any;
    try {
        msg = JSON.parse(text);
    } catch {
        return undefined;
    }
    if (!msg || typeof msg !== "object" || msg.v !== PROTOCOL_VERSION) return undefined;
    switch (msg.type) {
        case "clear":
        case "ping":
            return msg;
        case "activity": {
            const a = msg.activity;
            if (!a || typeof a !== "object" || typeof a.name !== "string" || !ACTIVITY_TYPES.includes(a.type)) return undefined;
            return msg;
        }
        default:
            return undefined;
    }
}
