import { describe, expect, it } from "vitest";
import twitch from "../../src/presets/twitch.ts";
import { NOW, playing, presenceFor } from "./load.ts";

describe("twitch preset", () => {
    it("live: title, channel and game, start only, channel button", () => {
        const p = presenceFor(twitch, "twitch/live.html", "https://www.twitch.tv/somestreamer",
            playing(30, Infinity, { title: "Chill stream !discord", artist: "Somestreamer" }));
        expect(p).toMatchObject({
            details: "Chill stream !discord", state: "Somestreamer — Just Chatting",
            startTimestamp: NOW - 30_000,
            buttons: [{ label: "Watch live", url: "https://www.twitch.tv/somestreamer" }]
        });
        expect(p?.endTimestamp).toBeUndefined();
    });
    it("live without mediaSession: DOM fallbacks", () => {
        const p = presenceFor(twitch, "twitch/live.html", "https://www.twitch.tv/somestreamer");
        expect(p).toMatchObject({ details: "Chill stream !discord", state: "Somestreamer — Just Chatting" });
    });
    it("VOD: progress and channel button", () => {
        const p = presenceFor(twitch, "twitch/vod.html", "https://www.twitch.tv/videos/123456",
            playing(100, 5000, { title: "Chill stream !discord", artist: "Somestreamer" }));
        expect(p).toMatchObject({
            details: "Chill stream !discord", state: "Somestreamer",
            startTimestamp: NOW - 100_000, endTimestamp: NOW + 4_900_000,
            buttons: [{ label: "Open channel", url: "https://www.twitch.tv/Somestreamer" }]
        });
    });
    it("VOD paused", () => {
        const p = presenceFor(twitch, "twitch/vod.html", "https://www.twitch.tv/videos/123456",
            { ...playing(100, 5000, { title: "T", artist: "A" }), paused: true });
        expect(p?.smallImage).toBe("pause");
    });
    it("home and directory: Browsing", () => {
        for (const u of ["https://www.twitch.tv/", "https://www.twitch.tv/directory/all"])
            expect(presenceFor(twitch, "twitch/home.html", u)?.details).toBe("Browsing");
    });
});
