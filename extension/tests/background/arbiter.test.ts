import { describe, expect, it } from "vitest";
import { pickDriver, samePayload, type Candidate } from "../../src/background/arbiter.ts";

const c = (tabId: number, focusedAt: number, playing = false): Candidate => ({
    tabId, ruleId: "r", presence: { name: "x", type: 0 }, playing, focusedAt, aliveAt: 0
});

describe("pickDriver", () => {
    it("returns null without candidates", () => expect(pickDriver([])).toBeNull());
    it("playing media wins over a more recent focus", () =>
        expect(pickDriver([c(1, 10, true), c(2, 20)])?.tabId).toBe(1));
    it("otherwise the last focused wins", () => expect(pickDriver([c(1, 10), c(2, 20), c(3, 5)])?.tabId).toBe(2));
    it("among playing tabs, the last focused wins", () =>
        expect(pickDriver([c(1, 30, true), c(2, 20, true), c(3, 40)])?.tabId).toBe(1));
    it("removing the driver hands over to the next one", () => {
        const all = [c(1, 10), c(2, 20)];
        expect(pickDriver(all.filter(x => x.tabId !== 2))?.tabId).toBe(1);
    });
    it("equal focus: higher tabId wins regardless of order", () => {
        expect(pickDriver([c(1, 10), c(2, 10)])?.tabId).toBe(2);
        expect(pickDriver([c(2, 10), c(1, 10)])?.tabId).toBe(2);
    });
});

describe("samePayload", () => {
    it("ignores key order and undefined keys", () =>
        expect(samePayload({ name: "a", type: 0, state: undefined }, { type: 0, name: "a" })).toBe(true));
    it("compares nested arrays", () => {
        const b = (url: string) => ({ name: "a", type: 0, buttons: [{ label: "l", url }] });
        expect(samePayload(b("u"), b("u"))).toBe(true);
        expect(samePayload(b("u"), b("v"))).toBe(false);
    });
    it("null vs payload", () => {
        expect(samePayload(null, { name: "a", type: 0 })).toBe(false);
        expect(samePayload(null, null)).toBe(true);
    });
});
