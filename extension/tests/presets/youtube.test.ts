import { describe, expect, it } from "vitest";
import youtube from "../../src/presets/youtube.ts";
import { NOW, playing, presenceFor } from "./load.ts";

const URL_ = "https://www.youtube.com/watch?v=jNQXAC9IVRw&t=3";

describe("youtube preset", () => {
    it("playing video: title, channel, thumbnail, progress, button", () => {
        const p = presenceFor(youtube, "youtube/watch.html", URL_, playing(10, 19, { title: "Me at the zoo", artist: "jawed" }));
        expect(p).toMatchObject({
            details: "Me at the zoo", state: "jawed",
            largeImage: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
            startTimestamp: NOW - 10_000, endTimestamp: NOW + 9_000,
            buttons: [{ label: "Watch on YouTube", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" }]
        });
    });
    it("falls back to document title and DOM channel without mediaSession", () => {
        const p = presenceFor(youtube, "youtube/watch.html", URL_, playing(0, 19));
        expect(p).toMatchObject({ details: "Me at the zoo", state: "jawed" });
    });
    it("paused: no timestamps, pause icon", () => {
        const p = presenceFor(youtube, "youtube/watch.html", URL_, { ...playing(5, 19), paused: true });
        expect(p?.startTimestamp).toBeUndefined();
        expect(p?.smallImage).toBe("pause");
    });
    it("live: start only", () => {
        const p = presenceFor(youtube, "youtube/watch.html", "https://www.youtube.com/live/jNQXAC9IVRw", playing(60, Infinity));
        expect(p?.startTimestamp).toBe(NOW - 60_000);
        expect(p?.endTimestamp).toBeUndefined();
    });
    it("shorts: id from path", () => {
        const p = presenceFor(youtube, "youtube/watch.html", "https://www.youtube.com/shorts/7uvYZ8fDK0Y", playing(1, 30));
        expect(p?.largeImage).toBe("https://i.ytimg.com/vi/7uvYZ8fDK0Y/hqdefault.jpg");
    });
    it("home: Browsing", () => {
        const p = presenceFor(youtube, "youtube/home.html", "https://www.youtube.com/");
        expect(p).toMatchObject({ details: "Browsing", largeImage: youtube.logo });
        expect(p?.buttons).toBeUndefined();
    });
});
