import { describe, expect, it } from "vitest";
import claude from "../../src/presets/claude.ts";
import { presenceFor } from "./helpers.ts";

describe("claude preset", () => {
    it("never leaks page text, title or button", () => {
        const p = presenceFor(claude, "claude/chat.html", "https://claude.ai/chat/abc")!;
        expect(p.details).toBe("Chatting with Claude");
        expect(p.buttons).toBeUndefined();
        expect(JSON.stringify(p)).not.toMatch(/layoff|SECRET|abc/i);
    });
});
