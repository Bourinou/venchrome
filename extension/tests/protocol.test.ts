import { describe, expect, it } from "vitest";
import { HOST, PORT, PROTOCOL_VERSION } from "../../plugin/venchrome/protocol";

describe("protocol", () => {
    it("matches D-002/D-003", () => {
        expect(PORT).toBe(28463);
        expect(HOST).toBe("127.0.0.1");
        expect(PROTOCOL_VERSION).toBe(1);
    });
});
