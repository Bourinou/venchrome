import { describe, expect, it } from "vitest";
import { presets } from "../../src/presets/index.ts";
import { newRuleForm, ruleFromForm, ruleToForm, validateForm } from "../../src/options/form.ts";

describe("form <-> rule", () => {
    it("has presets to test", () => expect(presets.length).toBeGreaterThanOrEqual(8));
    for (const p of presets) {
        it(`round-trips ${p.id}`, () => {
            expect(ruleFromForm(ruleToForm(p))).toEqual(p);
            expect(validateForm(ruleToForm(p))).toEqual([]);
        });
    }
    it("preserves domMedia", () => {
        const r = { ...presets[0], domMedia: { pausedSelector: "a", progressSelector: "b", currentAttr: "c", maxAttr: "d" } };
        expect(ruleFromForm(ruleToForm(r))).toEqual(r);
    });
});

describe("validateForm", () => {
    const ok = () => newRuleForm("example.com", []);
    it("accepts a new rule", () => expect(validateForm(ok())).toEqual([]));
    it("prefills details with {title} and unique id", () => {
        const f = newRuleForm("https://Example.com/x", ["example-com"]);
        expect(f.id).toBe("example-com-2");
        expect(ruleFromForm(f).pages[0]).toEqual({ details: "{title}" });
    });
    it("rejects empty host", () => expect(validateForm({ ...ok(), hosts: " \n" })).toContain("Add at least one host."));
    it("rejects invalid regexes", () => {
        const f = ok();
        f.fields = [{ name: "a", from: "url", p1: "(", p2: "" }];
        f.pages[0].path = "[";
        f.pages[0].when = [{ field: "a", exists: "", matches: "(" }];
        const e = validateForm(f).join("|");
        expect(e).toContain('Field "a": invalid regex');
        expect(e).toContain("invalid path regex");
        expect(e).toContain("invalid condition regex");
    });
    it("rejects non-https logo and button", () => {
        const f = ok();
        f.logo = "http://x/y.png";
        f.pages[0].buttonLabel = "Go";
        f.pages[0].buttonUrl = "http://x";
        const e = validateForm(f);
        expect(e).toContain("Logo must be an https URL.");
        expect(e).toContain("Page 1: button URL must be https.");
    });
    it("accepts a templated button URL", () => {
        const f = ok();
        f.pages[0].buttonLabel = "Go";
        f.pages[0].buttonUrl = "{url}";
        expect(validateForm(f)).toEqual([]);
    });
});
