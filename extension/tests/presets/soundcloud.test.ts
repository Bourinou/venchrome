import { describe, expect, it } from "vitest";
import soundcloud from "../../src/presets/soundcloud.ts";
import { NOW, readSession, runFixture } from "./media-helpers.ts";

const session = readSession("soundcloud");
const URL_ = "https://soundcloud.com/discover";

describe("soundcloud preset", () => {
    it("playing: title, artist, cover, timestamps, button", () => {
        const p = runFixture(soundcloud, "soundcloud", "playing", URL_, session)!;
        expect(p).toMatchObject({ name: "SoundCloud", type: 2, details: "Some Track", state: "Some Artist", largeImage: session.artwork });
        expect(p.startTimestamp).toBe(NOW - 26_000);
        expect(p.endTimestamp).toBe(NOW + 169_000);
        expect(p.buttons).toEqual([{ label: "Listen on SoundCloud", url: "https://soundcloud.com/someartist/some-track" }]);
    });
    it("paused: pause icon, no timestamps", () => {
        const p = runFixture(soundcloud, "soundcloud", "paused", URL_, session)!;
        expect(p.smallImage).toBe("pause");
        expect(p.endTimestamp).toBeUndefined();
    });
    it("nothing playing: no presence", () => {
        expect(runFixture(soundcloud, "soundcloud", "idle", URL_)).toBeNull();
    });
});
