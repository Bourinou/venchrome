import { describe, expect, it } from "vitest";
import bbb from "../../src/presets/bbb.ts";
import { ruleMatchesHost } from "../../src/rules/match.ts";
import { presenceFor } from "./helpers.ts";

describe("bbb preset", () => {
    it("shows generic text and never leaks room, participants, chat or button", () => {
        const p = presenceFor(bbb, "bbb/meeting.html", "https://bbb.example.org/html5client/join?sessionToken=abc")!;
        expect(p.details).toBe("In a BigBlueButton meeting");
        expect(p.buttons).toBeUndefined();
        expect(JSON.stringify(p)).not.toMatch(/secret|alice|dupont|abc/i);
    });

    it("uses the BBB logo as large image", () => {
        const p = presenceFor(bbb, "bbb/meeting.html", "https://bbb.example.org/html5client/join")!;
        expect(bbb.logo).toMatch(/^https:\/\//);
        expect(p.largeImage).toBe(bbb.logo);
    });

    it("only presents on /html5client", () => {
        expect(presenceFor(bbb, "bbb/meeting.html", "https://bbb.example.org/b/room-x")).toBeNull();
    });

    it("matches bbb* hosts on any TLD", () => {
        expect(ruleMatchesHost(bbb, "bbb.lirmm.fr")).toBe(true);
        expect(ruleMatchesHost(bbb, "bbb2.school.org")).toBe(true);
        expect(ruleMatchesHost(bbb, "example.org")).toBe(false);
    });
});
