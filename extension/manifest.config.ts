import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "Venchrome",
    version: "0.1.0",
    description: "Shows your activity on configured sites as a Discord Rich Presence via a local Vencord plugin.",
    permissions: ["storage", "tabs", "alarms"],
    host_permissions: ["<all_urls>"],
    background: { service_worker: "src/background/index.ts", type: "module" },
    content_scripts: [
        { matches: ["<all_urls>"], js: ["src/content/index.ts"], run_at: "document_idle" },
        { matches: ["<all_urls>"], js: ["src/content/main-world.ts"], run_at: "document_idle", world: "MAIN" }
    ],
    options_page: "src/options/index.html",
    action: { default_popup: "src/popup/index.html" }
});
