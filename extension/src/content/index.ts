// Isolated-world content script, declared on <all_urls> (D-008). Exits early when no enabled rule matches;
// only the message and storage listeners stay (preview of a draft rule works on any tab).
import type { ContentToWorker } from "../messages.ts";
import { getRules, loadState, onStateChange } from "../storage.ts";
import { createRunner } from "./run.ts";

const runner = createRunner(window, (m: ContentToWorker) => {
    // Throws synchronously ("Extension context invalidated") after an extension reload: runner stops.
    void chrome.runtime.sendMessage(m).catch(() => {});
});

async function refresh() {
    try {
        const [state, rules] = await Promise.all([loadState(), getRules()]);
        runner.setRules(rules, state.enabled);
    } catch {
        runner.stop();
    }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const answer = runner.handle(msg);
    if (answer) sendResponse(answer);
});
onStateChange(() => void refresh());
void refresh();
