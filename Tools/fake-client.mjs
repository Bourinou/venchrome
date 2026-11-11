// Fake extension client for the Venchrome plugin. No dependencies (Node >= 22 global WebSocket).
// Usage: node Tools/fake-client.mjs activity|clear [--hold <s>] [--port <n>]
// Exit 0 once the message is sent (and held), 1 on any error.

const args = process.argv.slice(2);
const command = args[0];
const opt = name => {
    const i = args.indexOf(name);
    return i >= 0 ? Number(args[i + 1]) : undefined;
};
const hold = opt("--hold") ?? 0;
const port = opt("--port") ?? 28463;

if (command !== "activity" && command !== "clear") {
    console.error("Usage: node Tools/fake-client.mjs activity|clear [--hold <s>] [--port <n>]");
    process.exit(1);
}

const message = command === "clear"
    ? { v: 1, type: "clear" }
    : {
        v: 1,
        type: "activity",
        activity: {
            name: "Venchrome test",
            type: 3,
            details: "Fake client",
            state: "Testing the plugin",
            smallImage: "play",
            smallText: "Playing",
            startTimestamp: Date.now(),
            buttons: [{ label: "Venchrome", url: "https://example.com" }]
        }
    };

const fail = msg => {
    console.error(`fake-client: ${msg}`);
    process.exit(1);
};
const timeout = setTimeout(() => fail("no hello from server within 5 s"), 5000);

const ws = new WebSocket(`ws://127.0.0.1:${port}`);
ws.onerror = () => fail(`cannot connect to 127.0.0.1:${port}`);
ws.onmessage = e => {
    const data = JSON.parse(String(e.data));
    if (data.type !== "hello") return;
    clearTimeout(timeout);
    ws.send(JSON.stringify(message));
    console.log(`fake-client: sent ${command}${hold ? `, holding ${hold} s` : ""}`);
    setTimeout(() => {
        ws.onclose = () => process.exit(0);
        ws.close(1000);
    }, hold * 1000);
};
