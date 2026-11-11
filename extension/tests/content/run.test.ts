// @vitest-environment-options {"url":"https://www.demo.test/"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEBOUNCE_MS, createRunner, samePresence, type ContentRunner } from "../../src/content/run.ts";
import { EV_MEDIA_SESSION, EV_URL_CHANGE } from "../../src/content/events.ts";
import type { ContentToWorker } from "../../src/messages.ts";
import type { Rule } from "../../src/rules/types.ts";

const rule: Rule = {
    id: "demo", name: "Demo", enabled: true, hosts: ["demo"], activityType: 3,
    fields: { item: { from: "selector", selector: "#item" }, song: { from: "mediaSession", key: "title" } },
    pages: [
        { path: "^/watch", when: [{ field: "item", exists: true }], details: "{item}", state: "{song}", media: true },
        { path: "^/home", details: "Browsing" }
    ]
};

const localRule = rule;

let sent: ContentToWorker[];
let runner: ContentRunner;

function setMedia(paused: boolean, currentTime = 10, duration = 100) {
    let v = document.querySelector("video");
    if (!v) document.body.append(v = document.createElement("video"));
    Object.defineProperty(v, "paused", { configurable: true, get: () => paused });
    Object.defineProperty(v, "currentTime", { configurable: true, get: () => currentTime });
    Object.defineProperty(v, "duration", { configurable: true, get: () => duration });
    return v;
}

beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="item">Episode 1</div>`;
    history.replaceState(null, "", "/watch?v=1");
    sent = [];
    runner = createRunner(window, m => sent.push(m));
});
afterEach(() => {
    runner.stop();
    vi.useRealTimers();
});

describe("content runner", () => {
    it("exits early: no matching rule or flag off", () => {
        runner.setRules([{ ...localRule, hosts: ["other"] }], true);
        runner.setRules([localRule], false);
        expect(sent).toEqual([]);
    });

    it("sends update once, then only on change (debounced)", async () => {
        runner.setRules([localRule], true);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ type: "update", ruleId: "demo", presence: { details: "Episode 1" } });
        runner.flush();
        expect(sent).toHaveLength(1);
        document.getElementById("item")!.textContent = "Episode 2";
        document.getElementById("item")!.textContent = "Episode 3";
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
        expect(sent).toHaveLength(2);
        expect(sent[1]).toMatchObject({ presence: { details: "Episode 3" } });
    });

    it("SPA url change switches page, leaving rule pages sends gone", async () => {
        runner.setRules([localRule], true);
        history.pushState(null, "", "/home");
        document.dispatchEvent(new CustomEvent(EV_URL_CHANGE));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
        expect(sent.at(-1)).toMatchObject({ presence: { details: "Browsing" } });
        history.pushState(null, "", "/nowhere");
        window.dispatchEvent(new PopStateEvent("popstate"));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
        expect(sent.at(-1)).toEqual({ type: "gone" });
    });

    it("play / pause and mediaSession", async () => {
        const v = setMedia(false);
        document.dispatchEvent(new CustomEvent(EV_MEDIA_SESSION, { detail: JSON.stringify({ title: "Song" }) }));
        runner.setRules([localRule], true);
        const first = sent.at(-1) as Extract<ContentToWorker, { type: "update" }>;
        expect(first.playing).toBe(true);
        expect(first.presence.state).toBe("Song");
        expect(first.presence.startTimestamp).toBeTypeOf("number");
        setMedia(true);
        v.dispatchEvent(new Event("pause"));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
        const paused = sent.at(-1) as Extract<ContentToWorker, { type: "update" }>;
        expect(paused.playing).toBe(false);
        expect(paused.presence.smallImage).toBe("pause");
        expect(paused.presence.startTimestamp).toBeUndefined();
    });

    it("pagehide sends gone, ping answers alive", () => {
        runner.setRules([localRule], true);
        expect(runner.handle({ type: "ping" })).toEqual({ type: "alive" });
        window.dispatchEvent(new Event("pagehide"));
        expect(sent.at(-1)).toEqual({ type: "gone" });
    });

    it("preview evaluates a draft rule without sending", () => {
        const res = runner.handle({ type: "preview", rule: { ...localRule, enabled: false } });
        expect(res).toMatchObject({ type: "previewResult", matched: true, fields: { item: "Episode 1" }, presence: { details: "Episode 1" } });
        expect(runner.handle({ type: "preview", rule: { ...localRule, hosts: ["x"] } })).toMatchObject({ matched: false });
        expect(sent).toEqual([]);
    });

    it("stops when send throws (context invalidated)", () => {
        const r = createRunner(window, () => { throw new Error("Extension context invalidated"); });
        r.setRules([localRule], true);
        document.getElementById("item")!.textContent = "x";
        expect(() => r.flush()).not.toThrow();
    });
});

describe("samePresence", () => {
    const p = { name: "a", type: 3 as const, startTimestamp: 1000 };
    it("tolerates ±2 s drift", () => {
        expect(samePresence(p, { ...p, startTimestamp: 2900 })).toBe(true);
        expect(samePresence(p, { ...p, startTimestamp: 3500 })).toBe(false);
        expect(samePresence(p, null)).toBe(false);
    });
});
