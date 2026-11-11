// @vitest-environment node
/// <reference types="node" />
import { request } from "node:http";
import { createServer } from "node:net";
import { afterEach, expect, it } from "vitest";
import { start, WsServer } from "../venchrome/wsServer";

const PORT = 28490;
let server: WsServer | undefined;

afterEach(async () => {
    await server?.stop();
    server = undefined;
});

function open(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
        ws.onopen = () => resolve(ws);
        ws.onerror = () => reject(new Error("ws error"));
    });
}

function nextMessage(ws: WebSocket): Promise<string> {
    return new Promise(resolve => { ws.onmessage = e => resolve(String(e.data)); });
}

async function echoServer() {
    server = await start(PORT, { onMessage: (c, text) => c.send(text) });
}

it("handshakes and round-trips JSON", async () => {
    await echoServer();
    const ws = await open();
    const msg = JSON.stringify({ v: 1, type: "ping" });
    const reply = nextMessage(ws);
    ws.send(msg);
    expect(JSON.parse(await reply)).toEqual({ v: 1, type: "ping" });
    ws.close();
});

it.each([126, 200, 70_000])("handles a %i byte message", async size => {
    await echoServer();
    const ws = await open();
    const msg = "x".repeat(size);
    const reply = nextMessage(ws);
    ws.send(msg);
    expect(await reply).toBe(msg);
    ws.close();
});

it("broadcasts with send()", async () => {
    server = await start(PORT, {});
    const ws = await open();
    const reply = nextMessage(ws);
    await new Promise(r => setTimeout(r, 20));
    expect(server.clientCount).toBe(1);
    server.send("hi");
    expect(await reply).toBe("hi");
    ws.close();
});

function upgradeStatus(origin?: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const req = request({
            host: "127.0.0.1", port: PORT,
            headers: {
                Connection: "Upgrade", Upgrade: "websocket",
                "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", "Sec-WebSocket-Version": "13",
                ...(origin ? { Origin: origin } : {})
            }
        });
        req.on("upgrade", (res, socket) => { socket.destroy(); resolve(res.statusCode!); });
        req.on("response", res => resolve(res.statusCode!));
        req.on("error", reject);
        req.end();
    });
}

it("applies the Origin rule (D-002)", async () => {
    await echoServer();
    expect(await upgradeStatus("https://evil.example")).toBe(403);
    expect(await upgradeStatus("chrome-extension://abc")).toBe(101);
    expect(await upgradeStatus()).toBe(101);
});

it("closes cleanly and reports disconnect", async () => {
    let disconnected!: () => void;
    const gone = new Promise<void>(r => { disconnected = r; });
    server = await start(PORT, { onDisconnect: () => disconnected() });
    const ws = await open();
    const closed = new Promise<CloseEvent>(r => { ws.onclose = r; });
    ws.close(1000);
    expect((await closed).wasClean).toBe(true);
    await gone;
    expect(server.clientCount).toBe(0);
});

it("stop() frees the port", async () => {
    await echoServer();
    const ws = await open();
    await server!.stop();
    server = undefined;
    ws.close();
    await new Promise<void>((resolve, reject) => {
        const s = createServer().once("error", reject).listen(PORT, "127.0.0.1", () => s.close(() => resolve()));
    });
});

it("reports a busy port without throwing", async () => {
    await echoServer();
    let error: Error | undefined;
    const second = await start(PORT, { onError: e => { error = e; } });
    expect(error).toBeDefined();
    await second.stop();
});
