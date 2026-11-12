import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createThrottle } from "../venchrome/throttle";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function setup() {
    const sent: unknown[] = [];
    const t = createThrottle<unknown>(v => sent.push(v), 15_000);
    return { sent, t };
}

it("sends the first value immediately (leading)", () => {
    const { sent, t } = setup();
    t.push("a");
    expect(sent).toEqual(["a"]);
});

it("settle: a burst before the leading send only sends its end (D-017)", () => {
    const sent: unknown[] = [];
    const t = createThrottle<unknown>(v => sent.push(v), 5_000, undefined, 1_500);
    t.push("paused");
    t.push("playing");
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1_500);
    expect(sent).toEqual(["playing"]);
    t.push("x");
    vi.advanceTimersByTime(4_999);
    expect(sent).toEqual(["playing"]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual(["playing", "x"]);
});

it("sends only the last value at the end of the window (trailing)", () => {
    const { sent, t } = setup();
    t.push("a");
    t.push("b");
    t.push("c");
    expect(sent).toEqual(["a"]);
    vi.advanceTimersByTime(15_000);
    expect(sent).toEqual(["a", "c"]);
});

it("skips identical values", () => {
    const { sent, t } = setup();
    t.push({ x: 1 });
    t.push({ x: 1 });
    vi.advanceTimersByTime(15_000);
    t.push({ x: 1 });
    expect(sent).toEqual([{ x: 1 }]);
});

it("skips a trailing value equal to the last sent one", () => {
    const { sent, t } = setup();
    t.push("a");
    t.push("b");
    t.push("a");
    vi.advanceTimersByTime(15_000);
    expect(sent).toEqual(["a"]);
});

it("keeps throttling after a trailing send", () => {
    const { sent, t } = setup();
    t.push("a");
    t.push("b");
    vi.advanceTimersByTime(15_000);
    t.push("c");
    expect(sent).toEqual(["a", "b"]);
    vi.advanceTimersByTime(15_000);
    expect(sent).toEqual(["a", "b", "c"]);
});

it("cancel drops the pending value and resets", () => {
    const { sent, t } = setup();
    t.push("a");
    t.push("b");
    t.cancel();
    vi.advanceTimersByTime(15_000);
    t.push("a");
    expect(sent).toEqual(["a", "a"]);
});

it("handles null (clear) like any value", () => {
    const { sent, t } = setup();
    t.push("a");
    t.push(null);
    vi.advanceTimersByTime(15_000);
    expect(sent).toEqual(["a", null]);
});
