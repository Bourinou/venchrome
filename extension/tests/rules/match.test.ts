import { describe, expect, it } from "vitest";
import { findRule, matchHost, pickPage } from "../../src/rules/match.ts";
import type { Rule } from "../../src/rules/types.ts";

describe("matchHost", () => {
    it("matches a dotless entry on any TLD", () => {
        expect(matchHost("anime-sama.fr", "anime-sama")).toBe(true);
        expect(matchHost("anime-sama.tv", "anime-sama")).toBe(true);
        expect(matchHost("www.anime-sama.org", "anime-sama")).toBe(true);
    });
    it("does not match a dotless entry on the TLD or partial labels", () => {
        expect(matchHost("example.youtube", "youtube")).toBe(false);
        expect(matchHost("notyoutube.com", "youtube")).toBe(false);
    });
    it("matches a dotted entry on exact host and subdomains", () => {
        expect(matchHost("claude.ai", "claude.ai")).toBe(true);
        expect(matchHost("www.claude.ai", "claude.ai")).toBe(true);
        expect(matchHost("notclaude.ai", "claude.ai")).toBe(false);
    });
    it("keeps github.io apart from github.com", () => {
        expect(matchHost("user.github.io", "github.com")).toBe(false);
        expect(matchHost("gist.github.com", "github.com")).toBe(true);
    });
    it("is case-insensitive", () => {
        expect(matchHost("WWW.YouTube.COM", "youtube")).toBe(true);
    });
});

const rule: Rule = {
    id: "t", name: "T", enabled: true, hosts: ["t"], activityType: 0, fields: {},
    pages: [
        { path: "^/watch", when: [{ field: "v", exists: true }], details: "a" },
        { path: "^/watch", details: "b" },
        { when: [{ field: "k", matches: "^x" }], details: "c" },
        { details: "d" }
    ]
};

describe("pickPage", () => {
    it("picks the first page whose path and when pass", () => {
        expect(pickPage(rule, "/watch", { v: "1" })?.details).toBe("a");
        expect(pickPage(rule, "/watch", {})?.details).toBe("b");
        expect(pickPage(rule, "/", { k: "xy" })?.details).toBe("c");
        expect(pickPage(rule, "/", { k: "y" })?.details).toBe("d");
    });
    it("returns undefined when nothing passes", () => {
        expect(pickPage({ ...rule, pages: [{ path: "^/a" }] }, "/b", {})).toBeUndefined();
    });
    it("findRule skips disabled rules", () => {
        expect(findRule([{ ...rule, enabled: false }], "t.com")).toBeUndefined();
        expect(findRule([rule], "t.com")?.id).toBe("t");
    });
});
