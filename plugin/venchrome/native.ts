// Runs in Discord's Node process. WebSocket server comes in a later plan (D-001).
import { PORT } from "./protocol";

export function getPort() {
    return PORT;
}
