import { describe, expect, it } from "vitest";
import deezer from "../../src/presets/deezer.ts";
import { NOW, readSession, runFixture } from "./media-helpers.ts";

const session = readSession("deezer");
const URL_ = "https://www.deezer.com/us/";

describe("deezer preset", () => {
    it("playing: title, artist, cover, timestamps", () => {
        const p = runFixture(deezer, "deezer", "playing", URL_, session)!;
        expect(p).toMatchObject({ name: "Deezer", type: 2, details: "I GOT YOU!", largeImage: session.artwork });
        expect(p.state).toContain("Giga");
        expect(p.startTimestamp).toBe(NOW - 26_132);
        expect(p.endTimestamp).toBe(NOW - 26_132 + 195_000);
        expect(p.buttons).toBeUndefined();
    });
    it("paused: pause icon, no timestamps", () => {
        const p = runFixture(deezer, "deezer", "paused", URL_, session)!;
        expect(p.smallImage).toBe("pause");
        expect(p.startTimestamp).toBeUndefined();
    });
    it("nothing playing: no presence", () => {
        expect(runFixture(deezer, "deezer", "idle", URL_)).toBeNull();
    });
    it("falls back to the DOM when mediaSession is empty", () => {
        const p = runFixture(deezer, "deezer", "playing", URL_)!;
        expect(p.details).toBe("I GOT YOU!");
        expect(p.largeImage).toContain("dzcdn.net/images/cover");
    });
});
