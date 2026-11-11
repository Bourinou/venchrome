import type { Status, UiToWorker } from "../messages.ts";
import { loadState, onStateChange, setEnabled } from "../storage.ts";
import { el, presenceLines } from "../ui.ts";

const app = document.getElementById("app")!;
app.className = "popup";

async function render() {
    const [state, status] = await Promise.all([
        loadState(),
        chrome.runtime.sendMessage({ type: "getStatus" } satisfies UiToWorker) as Promise<Status | undefined>
    ]);
    const toggle = el("input", { type: "checkbox", checked: state.enabled });
    toggle.addEventListener("change", () => void setEnabled(toggle.checked));
    const connected = status?.connected ?? false;
    app.replaceChildren(
        el("h1", {}, "Venchrome"),
        el("label", { class: "row" }, toggle, "Show activity on Discord"),
        el("p", { class: connected ? "ok" : "error" },
            connected ? "Connected to the Vencord plugin" : "Not connected to the Vencord plugin (is Discord running?)"),
        el("h2", {}, "Current presence"),
        el("pre", {}, status?.presence ? presenceLines(status.presence) : "(nothing)"),
        el("button", { onclick: () => void chrome.runtime.openOptionsPage() }, "Open options")
    );
}

void render();
onStateChange(() => void render());
