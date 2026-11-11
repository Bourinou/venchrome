import { describe, expect, it } from "vitest";
import { MAX_LEN, renderTemplate } from "../../src/rules/template.ts";

describe("renderTemplate", () => {
    const f = { a: "A", b: "", c: "C" };
    it("substitutes fields", () => {
        expect(renderTemplate("x {a} y", f)).toBe("x A y");
    });
    it("uses the first non-empty fallback", () => {
        expect(renderTemplate("{b|c}", f)).toBe("C");
        expect(renderTemplate("{zz|b|a}", f)).toBe("A");
    });
    it("omits empty lines", () => {
        expect(renderTemplate("{b}", f)).toBeUndefined();
        expect(renderTemplate("  {missing} ", f)).toBeUndefined();
        expect(renderTemplate(undefined, f)).toBeUndefined();
        expect(renderTemplate("", f)).toBeUndefined();
    });
    it("truncates to 128 chars", () => {
        const out = renderTemplate("{a}", { a: "x".repeat(300) })!;
        expect(out.length).toBe(MAX_LEN);
        expect(out.endsWith("…")).toBe(true);
        expect(renderTemplate("{a}", { a: "y".repeat(128) })).toBe("y".repeat(128));
    });
});
