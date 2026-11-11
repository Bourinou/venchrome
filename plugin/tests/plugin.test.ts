// @vitest-environment node
import { expect, it } from "vitest";
import { getPort } from "../venchrome/native";

it("native stub exposes the protocol port", () => {
    expect(getPort()).toBe(28463);
});

it("parseClientMessage validates v and type", async () => {
    const { parseClientMessage } = await import("../venchrome/parse");
    expect(parseClientMessage('{"v":1,"type":"ping"}')).toEqual({ v: 1, type: "ping" });
    expect(parseClientMessage('{"v":1,"type":"clear"}')).toEqual({ v: 1, type: "clear" });
    expect(parseClientMessage('{"v":1,"type":"activity","activity":{"name":"YouTube","type":3}}')?.type).toBe("activity");
    expect(parseClientMessage('{"v":2,"type":"ping"}')).toBeUndefined();
    expect(parseClientMessage('{"v":1,"type":"nope"}')).toBeUndefined();
    expect(parseClientMessage('{"v":1,"type":"activity","activity":{"name":"x","type":1}}')).toBeUndefined();
    expect(parseClientMessage("not json")).toBeUndefined();
});
