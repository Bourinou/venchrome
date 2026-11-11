// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { start, type WsServer } from "../../../plugin/venchrome/wsServer.ts";
import { createConnection, RECONNECT_ALARM } from "../../src/background/connection.ts";

const PORT = 28499;
const alarms: string[] = [];
(globalThis as any).chrome = {
    alarms: { create: async (name: string) => void alarms.push(name), clear: async () => true }
};

const until = (cond: () => boolean) => vi.waitFor(() => expect(cond()).toBe(true), { timeout: 3000 });

function server(received: string[]) {
    return start(PORT, {
        onConnect: c => c.send(JSON.stringify({ v: 1, type: "hello" })),
        onMessage: (_c, t) => received.push(t)
    });
}

let srv: WsServer | null = null;
afterEach(async () => void (await srv?.stop()));

describe("connection + real wsServer", () => {
    it("sends activity after hello, reconnects after a server restart", async () => {
        const received: string[] = [];
        srv = await server(received);
        let hellos = 0;
        const conn = createConnection({
            url: `ws://127.0.0.1:${PORT}`,
            onHello: () => {
                hellos++;
                conn.send({ type: "activity", activity: { name: "Test", type: 0 } });
            }
        });
        conn.ensure(true);
        await until(() => received.length === 1);
        expect(JSON.parse(received[0])).toEqual({ v: 1, type: "activity", activity: { name: "Test", type: 0 } });

        await srv.stop();
        await until(() => !conn.isConnected());
        expect(alarms).toContain(RECONNECT_ALARM);
        conn.ensure(true); // alarm fires, server still down
        await until(() => alarms.length >= 2);

        srv = await server(received);
        conn.ensure(true); // next alarm
        await until(() => hellos === 2 && received.length === 2);
        expect(conn.isConnected()).toBe(true);
        conn.close();
    });
});
