// Links vencord-hook/50-venchrome.mjs into the Vencord installer's hooks/ folder.
// Usage: node vencord-hook/install-hook.mjs [installerDir]
// installerDir defaults to $VENCORD_INSTALLER_DIR, then the sibling folder ../vencord-installer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), "50-venchrome.mjs");
const installer = path.resolve(process.argv[2] ?? process.env.VENCORD_INSTALLER_DIR ?? path.join(path.dirname(hook), "..", "..", "vencord-installer"));
const hooksDir = path.join(installer, "hooks");
if (!fs.existsSync(hooksDir)) { console.error(`installer hooks folder not found: ${hooksDir}`); process.exit(1); }

const link = path.join(hooksDir, "50-venchrome.mjs");
try {
    if (fs.realpathSync(link) === fs.realpathSync(hook)) { console.log("hook already linked"); process.exit(0); }
} catch { /* missing or broken */ }
fs.rmSync(link, { force: true });
try {
    fs.symlinkSync(hook, link, "file");
    console.log(`hook linked: ${link}`);
} catch (e) {
    // Windows without Developer Mode: copy instead, and tell the hook where the repo is.
    fs.copyFileSync(hook, link);
    console.log(`symlink refused (${e.code}); copied hook instead. Set VENCHROME_DIR=${path.resolve(path.dirname(hook), "..")}`);
}
