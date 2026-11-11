// @vitest-environment node
/// <reference types="node" />
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { parseClientMessage } from "../venchrome/parse";
import { start } from "../venchrome/wsServer";

const SCRIPT = fileURLToPath(new URL("../../Tools/fake-client.mjs", import.meta.url));
const PORT = 28491;

function run(command: string): Promise<number> {
    return new Promise(resolve => {
        execFile(process.execPath, [SCRIPT, command, "--port", String(PORT)], err => resolve(err ? (err.code as number ?? 1) : 0));
    });
}

it.each(["activity", "clear"])("fake-client %s exits 0 and sends a valid message", async command => {
    const received: string[] = [];
    const server = await start(PORT, {
        onConnect: c => c.send(JSON.stringify({ v: 1, type: "hello" })),
        onMessage: (_c, text) => received.push(text)
    });
    try {
        expect(await run(command)).toBe(0);
        expect(received).toHaveLength(1);
        expect(parseClientMessage(received[0])?.type).toBe(command);
    } finally {
        await server.stop();
    }
});

it("fake-client exits non-zero without a server", async () => {
    expect(await run("clear")).not.toBe(0);
});
