// Minimal RFC 6455 WebSocket server on node:http + node:crypto (D-001). Text frames only.
import { createHash } from "node:crypto";
import { createServer, IncomingMessage, Server } from "node:http";
import type { Socket } from "node:net";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_MESSAGE = 1 << 20; // 1 MiB, far above any presence payload

export interface Client {
    send(text: string): void;
    close(): void;
}

export interface Handlers {
    onConnect?(client: Client): void;
    onMessage?(client: Client, text: string): void;
    onDisconnect?(client: Client): void;
    onError?(err: Error): void;
}

/** D-002: no Origin = local process; otherwise must be a Chrome extension. */
export function isOriginAllowed(origin: string | undefined) {
    return origin === undefined || origin.startsWith("chrome-extension://");
}

function frame(opcode: number, payload: Buffer) {
    const len = payload.length;
    let header: Buffer;
    if (len < 126) {
        header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | opcode; header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | opcode; header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([header, payload]);
}

function attach(socket: Socket, handlers: Handlers, clients: Set<Socket>) {
    let buf: Buffer = Buffer.alloc(0);
    let fragments: Buffer[] = [];
    let fragLen = 0;
    let closed = false;

    const client: Client = {
        send(text) {
            if (!closed) socket.write(frame(0x1, Buffer.from(text, "utf8")));
        },
        close() {
            if (closed) return;
            closed = true;
            socket.end(frame(0x8, Buffer.from([0x03, 0xe8])));
        }
    };

    const fail = () => {
        closed = true;
        socket.destroy();
    };

    socket.on("data", (chunk: Buffer) => {
        buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
        while (buf.length >= 2 && !closed) {
            const fin = (buf[0] & 0x80) !== 0;
            const opcode = buf[0] & 0x0f;
            const masked = (buf[1] & 0x80) !== 0;
            let len = buf[1] & 0x7f;
            let off = 2;
            if (len === 126) {
                if (buf.length < 4) return;
                len = buf.readUInt16BE(2); off = 4;
            } else if (len === 127) {
                if (buf.length < 10) return;
                const big = buf.readBigUInt64BE(2);
                if (big > BigInt(MAX_MESSAGE)) return fail();
                len = Number(big); off = 10;
            }
            if (!masked || len > MAX_MESSAGE) return fail(); // client frames must be masked
            if (buf.length < off + 4 + len) return;
            const mask = buf.subarray(off, off + 4);
            const payload = Buffer.from(buf.subarray(off + 4, off + 4 + len));
            for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
            buf = buf.subarray(off + 4 + len);

            switch (opcode) {
                case 0x0: // continuation
                case 0x1: // text
                    if (opcode === 0x1 && fragments.length) return fail();
                    if (opcode === 0x0 && !fragments.length) return fail();
                    fragLen += len;
                    if (fragLen > MAX_MESSAGE) return fail();
                    fragments.push(payload);
                    if (fin) {
                        const text = Buffer.concat(fragments).toString("utf8");
                        fragments = []; fragLen = 0;
                        handlers.onMessage?.(client, text);
                    }
                    break;
                case 0x8: // close: echo and end
                    if (!closed) {
                        closed = true;
                        socket.end(frame(0x8, payload.subarray(0, 2)));
                    }
                    return;
                case 0x9: // ping
                    socket.write(frame(0xa, payload));
                    break;
                case 0xa: // pong
                    break;
                default: // binary and unknown opcodes are not part of the protocol
                    return fail();
            }
        }
    });

    socket.on("error", () => socket.destroy());
    socket.on("close", () => {
        closed = true;
        clients.delete(socket);
        handlers.onDisconnect?.(client);
    });

    clients.add(socket);
    handlers.onConnect?.(client);
}

export interface WsServer {
    readonly clientCount: number;
    /** Broadcast to every connected client. */
    send(text: string): void;
    stop(): Promise<void>;
}

/** Listens on 127.0.0.1 only. Never throws: listen errors go to handlers.onError. */
export function start(port: number, handlers: Handlers): Promise<WsServer> {
    const sockets = new Set<Socket>();
    const clients = new Map<Socket, Client>();

    const server: Server = createServer((_req, res) => {
        res.writeHead(426).end();
    });

    server.on("upgrade", (req: IncomingMessage, socket: Socket) => {
        const key = req.headers["sec-websocket-key"];
        if (
            req.headers.upgrade?.toLowerCase() !== "websocket"
            || typeof key !== "string"
            || !isOriginAllowed(req.headers.origin)
        ) {
            socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
            return;
        }
        const accept = createHash("sha1").update(key + GUID).digest("base64");
        socket.write(
            "HTTP/1.1 101 Switching Protocols\r\n"
            + "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
        );
        socket.setNoDelay(true);
        attach(socket, {
            ...handlers,
            onConnect: c => { clients.set(socket, c); handlers.onConnect?.(c); },
            onDisconnect: c => { clients.delete(socket); handlers.onDisconnect?.(c); }
        }, sockets);
    });

    const ws: WsServer = {
        get clientCount() { return clients.size; },
        send(text) {
            for (const c of clients.values()) c.send(text);
        },
        stop() {
            return new Promise(resolve => {
                for (const s of sockets) s.destroy();
                server.close(() => resolve());
            });
        }
    };

    return new Promise(resolve => {
        server.once("error", err => {
            handlers.onError?.(err);
            resolve(ws);
        });
        server.listen(port, "127.0.0.1", () => {
            server.on("error", err => handlers.onError?.(err));
            resolve(ws);
        });
    });
}
