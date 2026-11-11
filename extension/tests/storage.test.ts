import { describe, expect, it } from "vitest";
import { presets } from "../src/presets/index.ts";
import type { Rule } from "../src/rules/types.ts";
import { diffRule, mergeRules } from "../src/storage.ts";

const preset: Rule = {
    id: "p", name: "P", enabled: true, hosts: ["p"], activityType: 0, fields: {}, pages: [{ details: "x" }]
};
const custom: Rule = { ...preset, id: "c", name: "C" };

describe("mergeRules", () => {
    it("applies overrides to presets and appends custom rules", () => {
        const out = mergeRules([preset], { p: { enabled: false, name: "P2" } }, [custom]);
        expect(out).toEqual([{ ...preset, enabled: false, name: "P2" }, custom]);
    });
    it("never lets an override change the id or a custom rule shadow a preset", () => {
        const out = mergeRules([preset], { p: { id: "z" } as never }, [{ ...custom, id: "p" }]);
        expect(out).toEqual([preset]);
    });
    it("ignores overrides of unknown presets", () => {
        expect(mergeRules([preset], { gone: { name: "G" } }, [])).toEqual([preset]);
    });
});

describe("diffRule", () => {
    it("keeps only changed top-level keys and round-trips through mergeRules", () => {
        const edited: Rule = { ...preset, enabled: false, pages: [{ details: "y" }] };
        const diff = diffRule(preset, edited);
        expect(diff).toEqual({ enabled: false, pages: [{ details: "y" }] });
        expect(mergeRules([preset], { p: diff }, [])[0]).toEqual(edited);
    });
    it("is empty when nothing changed", () => {
        expect(diffRule(preset, JSON.parse(JSON.stringify(preset)))).toEqual({});
    });
});

describe("presets", () => {
    it("loads (no real preset yet) as an array of serialisable rules", () => {
        expect(Array.isArray(presets)).toBe(true);
        for (const p of presets) expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    });
});
