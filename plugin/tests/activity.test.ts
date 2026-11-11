import { expect, it } from "vitest";
import { toActivity } from "../venchrome/activity";

it("maps a minimal payload without optional fields", () => {
    expect(toActivity({ name: "YouTube", type: 3 }, "123")).toEqual({
        application_id: "123", name: "YouTube", type: 3, flags: 1
    });
});

it("maps every field", () => {
    expect(toActivity({
        name: "Deezer", type: 2, details: "Song", state: "Artist",
        largeImage: "https://x/cover.jpg", largeText: "Album", smallImage: "play", smallText: "Playing",
        startTimestamp: 1000, endTimestamp: 2000,
        buttons: [{ label: "Listen", url: "https://deezer.com/1" }, { label: "Artist", url: "https://deezer.com/a" }, { label: "Extra", url: "https://x" }]
    }, "123")).toEqual({
        application_id: "123", name: "Deezer", type: 2, flags: 1,
        details: "Song", state: "Artist",
        timestamps: { start: 1000, end: 2000 },
        assets: { large_image: "https://x/cover.jpg", large_text: "Album", small_image: "play", small_text: "Playing" },
        buttons: ["Listen", "Artist"],
        metadata: { button_urls: ["https://deezer.com/1", "https://deezer.com/a"] }
    });
});

it("keeps only the timestamps present", () => {
    expect(toActivity({ name: "x", type: 0, startTimestamp: 5 }, "1").timestamps).toEqual({ start: 5 });
    expect(toActivity({ name: "x", type: 0, smallImage: "pause" }, "1").timestamps).toBeUndefined();
});

it("drops incomplete buttons", () => {
    const a = toActivity({ name: "x", type: 0, buttons: [{ label: "", url: "https://x" }] }, "1");
    expect(a.buttons).toBeUndefined();
    expect(a.metadata).toBeUndefined();
});
