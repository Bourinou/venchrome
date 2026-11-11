import { describe, expect, it } from "vitest";
import { buildPresence } from "../../src/rules/presence.ts";
import type { MediaSnapshot, Rule, RulePage } from "../../src/rules/types.ts";

const LOGO = "https://logo/l.png";
const rule: Rule = { id: "t", name: "Tube", enabled: true, hosts: ["t"], activityType: 3, logo: LOGO, fields: {}, pages: [] };
const page: RulePage = { details: "{v}", state: "{c}", largeImage: "{thumb}", media: true };
const fields = { v: "Video", c: "", thumb: "https://img/t.jpg", url: "https://t.com/w" };
const NOW = 1_000_000_000_000;
const media = (o: Partial<MediaSnapshot>): MediaSnapshot => ({ paused: false, currentTime: 10, duration: 100, live: false, ...o });

describe("buildPresence", () => {
    it("returns null without a page", () => {
        expect(buildPresence(rule, undefined, fields)).toBeNull();
    });
    it("fills text, omits empty lines, logo small when thumbnail", () => {
        const p = buildPresence(rule, page, fields)!;
        expect(p).toEqual({ name: "Tube", type: 3, details: "Video", largeImage: "https://img/t.jpg", smallImage: LOGO, smallText: "Tube" });
    });
    it("uses the logo as large image without thumbnail", () => {
        const p = buildPresence(rule, { details: "x" }, fields)!;
        expect(p.largeImage).toBe(LOGO);
        expect(p.smallImage).toBeUndefined();
    });
    it("sets start and end timestamps while playing", () => {
        const p = buildPresence(rule, page, fields, media({}), NOW)!;
        expect(p.startTimestamp).toBe(NOW - 10_000);
        expect(p.endTimestamp).toBe(NOW + 90_000);
    });
    it("sets start only when live or duration unknown", () => {
        expect(buildPresence(rule, page, fields, media({ live: true, duration: Infinity }), NOW)!.endTimestamp).toBeUndefined();
        const p = buildPresence(rule, page, fields, media({ duration: NaN }), NOW)!;
        expect(p.startTimestamp).toBe(NOW - 10_000);
        expect(p.endTimestamp).toBeUndefined();
    });
    it("paused: no timestamps, pause icon (D-006)", () => {
        const p = buildPresence(rule, page, fields, media({ paused: true }), NOW)!;
        expect(p.startTimestamp).toBeUndefined();
        expect(p.endTimestamp).toBeUndefined();
        expect(p.smallImage).toBe("pause");
    });
    it("ignores media when the page does not use it", () => {
        const p = buildPresence(rule, { details: "x" }, fields, media({ paused: true }), NOW)!;
        expect(p.smallImage).toBeUndefined();
        expect(p.startTimestamp).toBeUndefined();
    });
    it("adds a button only when declared and the url is http(s)", () => {
        expect(buildPresence(rule, page, fields)!.buttons).toBeUndefined();
        expect(buildPresence(rule, { ...page, button: { label: "Watch", url: "{url}" } }, fields)!.buttons)
            .toEqual([{ label: "Watch", url: "https://t.com/w" }]);
        expect(buildPresence(rule, { ...page, button: { label: "W", url: "javascript:x" } }, fields)!.buttons).toBeUndefined();
    });
    it("survives JSON round-trip of the rule", () => {
        const r = JSON.parse(JSON.stringify(rule));
        expect(buildPresence(r, page, fields)).toEqual(buildPresence(rule, page, fields));
    });
});
