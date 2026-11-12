// Vencord installer hook: links plugin/venchrome into <vencord>/src/userplugins/venchrome.
// Usage: node 50-venchrome.mjs <vencordDir>
// The Venchrome repo is found from this file's real path (works when symlinked into
// the installer's hooks/ folder); if you copied the file instead, set VENCHROME_DIR.
// Idempotent: a correct link is kept, a wrong one is replaced.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function linkPlugin(vencordDir, repoDir) {
    const target = path.join(repoDir, "plugin", "venchrome");
    if (!fs.existsSync(target)) throw new Error(`plugin folder not found: ${target}`);

    const userPlugins = path.join(vencordDir, "src", "userplugins");
    const link = path.join(userPlugins, "venchrome");
    fs.mkdirSync(userPlugins, { recursive: true });

    let current = null;
    try { current = fs.lstatSync(link); } catch { /* missing */ }
    if (current) {
        if (current.isSymbolicLink() && fs.realpathSync(link) === fs.realpathSync(target)) return "unchanged";
        fs.rmSync(link, { recursive: true, force: true });
    }
    fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    return current ? "replaced" : "created";
}

export function findRepo() {
    if (process.env.VENCHROME_DIR) return path.resolve(process.env.VENCHROME_DIR);
    return path.resolve(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))), "..");
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    const vencordDir = process.argv[2];
    if (!vencordDir) { console.error("usage: node 50-venchrome.mjs <vencordDir>"); process.exit(1); }
    try {
        console.log(`[venchrome] link ${linkPlugin(vencordDir, findRepo())}`);
    } catch (e) {
        console.error(`[venchrome] ${e.message}`);
        process.exit(1);
    }
}
