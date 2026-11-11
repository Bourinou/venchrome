import { expect, it } from "vitest";
import { getPort } from "../venchrome/native";

it("native stub exposes the protocol port", () => {
    expect(getPort()).toBe(28463);
});
