// Runs in Discord's Node process (D-001). Never let an exception escape: it would crash Discord.
/// <reference types="node" />

import { parseClientMessage } from "./parse";
import { PORT, PresencePayload } from "./protocol";
import { start as startServer, WsServer } from "./wsServer";

// Structural subset of Electron's IpcMainInvokeEvent: keeps this file type-checkable without electron types.
interface WebContents {
    isDestroyed(): boolean;
    executeJavaScript(code: string): Promise<unknown>;
    once(event: "destroyed", listener: () => void): unknown;
}
interface IpcMainInvokeEvent { sender: WebContents; }

/** What the renderer receives: an activity to show, or null to clear. */
export type RendererUpdate = PresencePayload | null;

export function getPort() {
    return PORT;
}

const renderers = new Set<WebContents>();
let server: WsServer | undefined;
let starting: Promise<WsServer> | undefined;

function toRenderers(update: RendererUpdate) {
    const code = `Vencord.Plugins.plugins.Venchrome.onNativeUpdate(${JSON.stringify(update)})`;
    for (const wc of renderers) {
        if (wc.isDestroyed()) { renderers.delete(wc); continue; }
        wc.executeJavaScript(code).catch(() => { });
    }
}

function handleMessage(send: (text: string) => void, text: string) {
    const msg = parseClientMessage(text);
    if (!msg) return;
    switch (msg.type) {
        case "ping": send(JSON.stringify({ v: 1, type: "pong" })); break;
        case "activity": toRenderers(msg.activity); break;
        case "clear": toRenderers(null); break;
    }
}

/** Called by each renderer on plugin start. Idempotent: one server shared by all windows. */
export async function start(e: IpcMainInvokeEvent) {
    if (!renderers.has(e.sender)) {
        renderers.add(e.sender);
        e.sender.once("destroyed", () => renderers.delete(e.sender));
    }
    if (server || starting) return;
    starting = startServer(PORT, {
        onConnect: c => c.send(JSON.stringify({ v: 1, type: "hello" })),
        onMessage: (c, text) => {
            try { handleMessage(t => c.send(t), text); } catch (err) { console.error("[Venchrome]", err); }
        },
        onDisconnect: () => {
            if (server && server.clientCount === 0) toRenderers(null);
        },
        onError: err => console.error("[Venchrome] WebSocket server error:", err.message)
    }).catch(err => {
        console.error("[Venchrome]", err);
        return undefined as never;
    });
    server = await starting;
    starting = undefined;
}

/** Called by a renderer on plugin stop. Stops the server once no renderer remains. */
export async function stop(e: IpcMainInvokeEvent) {
    renderers.delete(e.sender);
    if (renderers.size || !server) return;
    const s = server;
    server = undefined;
    await s.stop().catch(() => { });
}
