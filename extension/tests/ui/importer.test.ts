import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { presets } from "../../src/presets/index.ts";
import { exportRules, parseImport } from "../../src/options/importer.ts";

const example = readFileSync("examples/rule.example.json", "utf8");
const ids = presets.map(p => p.id);

describe("parseImport", () => {
    it("accepts the documented example", () => {
        const r = parseImport(example, ids);
        expect(r.errors).toEqual([]);
        expect(r.rules).toEqual([JSON.parse(example)]);
    });
    it("round-trips export -> import for a rule and for several", () => {
        const custom = parseImport(example, ids).rules[0];
        expect(parseImport(exportRules([custom]), ids).rules).toEqual([custom]);
        const b = { ...custom, id: "other" };
        expect(parseImport(exportRules([custom, b]), ids).rules).toEqual([custom, b]);
    });
    it("round-trips every preset when its id is free", () => {
        for (const p of presets) expect(parseImport(exportRules([p]), []).rules).toEqual([p]);
    });
    it("reports invalid JSON", () => {
        expect(parseImport("{nope", ids).errors[0]).toMatch(/Not valid JSON/);
    });
    it("reports structural errors readably and imports nothing", () => {
        const r = parseImport(JSON.stringify({ id: "x", name: 3, hosts: "a", activityType: 1, pages: {} }), []);
        expect(r.rules).toEqual([]);
        expect(r.errors.join("\n")).toMatch(/"name" must be a string[\s\S]*"hosts"[\s\S]*"activityType"[\s\S]*"pages"/);
    });
    it("reports validation errors (bad regex, non-https logo)", () => {
        const bad = { ...JSON.parse(example), logo: "http://x", fields: { a: { from: "url", regex: "(" } } };
        const r = parseImport(JSON.stringify(bad), []);
        expect(r.errors.join("\n")).toMatch(/Logo must be an https URL[\s\S]*invalid regex/);
    });
    it("refuses an id clash with a preset or an existing rule", () => {
        const r = parseImport(JSON.stringify({ ...JSON.parse(example), id: ids[0] }), ids);
        expect(r.rules).toEqual([]);
        expect(r.errors[0]).toContain(`id "${ids[0]}" is already used`);
        expect(parseImport(example, ["example-blog"]).errors[0]).toContain("already used");
    });
    it("refuses duplicate ids inside one batch, importing none", () => {
        const r = parseImport(`[${example},${example}]`, []);
        expect(r.rules).toEqual([]);
        expect(r.errors[0]).toContain("Rule 2");
    });
    it("ignores unknown keys (data only)", () => {
        const r = parseImport(JSON.stringify({ ...JSON.parse(example), evil: "x" }), []);
        expect(r.rules[0]).not.toHaveProperty("evil");
    });
});
