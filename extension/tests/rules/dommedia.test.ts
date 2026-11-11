import { describe, expect, it } from "vitest";
import { domMediaSnapshot } from "../../src/rules/dommedia.ts";
import type { DomMedia } from "../../src/rules/types.ts";

const cfg: DomMedia = { pausedSelector: ".paused", progressSelector: "#bar", currentAttr: "aria-valuenow", maxAttr: "aria-valuemax" };
const doc = (html: string) => {
    const d = document.implementation.createHTMLDocument("t");
    d.body.innerHTML = html;
    return d;
};

describe("domMediaSnapshot", () => {
    it("undefined without config or progress element", () => {
        expect(domMediaSnapshot(undefined, doc(""), undefined)).toBeUndefined();
        expect(domMediaSnapshot(cfg, doc(""), undefined)).toBeUndefined();
    });
    it("playing when the paused selector is absent", () => {
        const s = domMediaSnapshot(cfg, doc(`<i id="bar" aria-valuenow="26.1" aria-valuemax="195"></i>`), { title: "T" })!;
        expect(s).toEqual({ paused: false, currentTime: 26.1, duration: 195, live: false, session: { title: "T" } });
    });
    it("paused when the paused selector is present", () => {
        const s = domMediaSnapshot(cfg, doc(`<b class="paused"></b><i id="bar" aria-valuenow="5" aria-valuemax="10"></i>`), undefined)!;
        expect(s.paused).toBe(true);
    });
    it("unreadable max = unknown duration; unreadable current = undefined; bad selector safe", () => {
        expect(domMediaSnapshot(cfg, doc(`<i id="bar" aria-valuenow="5"></i>`), undefined)!.duration).toBeNaN();
        expect(domMediaSnapshot(cfg, doc(`<i id="bar"></i>`), undefined)).toBeUndefined();
        expect(domMediaSnapshot({ ...cfg, progressSelector: "[[" }, doc(""), undefined)).toBeUndefined();
    });
});
