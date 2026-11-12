// WebSocket client to the Vencord plugin (D-002/D-003). The worker can sleep at any time:
// every entry point calls ensure(); a chrome.alarms retry with backoff covers "Discord closed".
import { HOST, PORT, PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from "../../../plugin/venchrome/protocol.ts";

export const RECONNECT_ALARM = "venchrome-reconnect";
/** Minutes. Chrome's minimum alarm delay is 0.5 min: the fallback when the worker sleeps. */
const BACKOFF = [0.5, 1, 2];
/** While awake (keepalive tick), retry this often (D-019). */
const MIN_GAP_MS = 5_000;
const KEEPALIVE_MS = 5_000;

export interface ConnectionOptions {
    url?: string;
    /** Server said hello: (re)send the current state. */
    onHello(): void;
    /** Connected state changed (true only after hello). */
    onState?(connected: boolean): void;
    /** Every 5 s while keepalive is on (liveness checks piggyback on it). */
    onTick?(): void;
}

export type ClientBody = ClientMessage extends infer M ? (M extends { v: 1 } ? Omit<M, "v"> : never) : never;

export function createConnection(opts: ConnectionOptions) {
    const url = opts.url ?? `ws://${HOST}:${PORT}`;
    let ws: WebSocket | null = null;
    let ready = false;
    let failures = 0;
    let lastAttempt = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const setReady = (v: boolean) => {
        if (ready === v) return;
        ready = v;
        opts.onState?.(v);
    };

    const scheduleRetry = () => {
        const delayInMinutes = BACKOFF[Math.min(failures, BACKOFF.length - 1)];
        failures++;
        void chrome.alarms.create(RECONNECT_ALARM, { delayInMinutes });
    };

    /** Open the socket if needed. `force` (alarm) skips the gap between attempts. */
    function ensure(force = false) {
        if (ws) return;
        if (!force && Date.now() - lastAttempt < MIN_GAP_MS) return;
        lastAttempt = Date.now();
        let sock: WebSocket;
        try {
            sock = new WebSocket(url);
        } catch {
            scheduleRetry();
            return;
        }
        ws = sock;
        sock.onmessage = ev => {
            let msg: ServerMessage;
            try {
                msg = JSON.parse(String(ev.data));
            } catch {
                return;
            }
            if (msg?.type === "hello") {
                failures = 0;
                void chrome.alarms.clear(RECONNECT_ALARM);
                setReady(true);
                opts.onHello();
            }
        };
        sock.onclose = () => {
            if (ws !== sock) return;
            ws = null;
            setReady(false);
            scheduleRetry();
        };
        sock.onerror = () => sock.close();
    }

    function send(body: ClientBody): boolean {
        if (!ready || !ws) return false;
        ws.send(JSON.stringify({ v: PROTOCOL_VERSION, ...body }));
        return true;
    }

    /** Keepalive pings (keep the worker awake while a presence is shown). */
    function setKeepalive(on: boolean) {
        if (on && !timer) {
            timer = setInterval(() => {
                send({ type: "ping" });
                opts.onTick?.();
            }, KEEPALIVE_MS);
        } else if (!on && timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function close() {
        setKeepalive(false);
        const s = ws;
        ws = null;
        setReady(false);
        s?.close();
    }

    return { ensure, send, setKeepalive, close, isConnected: () => ready };
}

export type Connection = ReturnType<typeof createConnection>;
