import type { Rule } from "../rules/types.ts";

// Deezer plays through WebAudio (no <audio>), so progress and pause come from the DOM (D-014).
const rule: Rule = {
    id: "deezer",
    name: "Deezer",
    enabled: true,
    hosts: ["deezer"],
    activityType: 2,
    logo: "https://www.google.com/s2/favicons?domain=deezer.com&sz=128",
    domMedia: {
        pausedSelector: "[data-testid=play_button_play]",
        progressSelector: "[data-testid=progress_bar]",
        currentAttr: "aria-valuenow",
        maxAttr: "aria-valuemax"
    },
    fields: {
        title: { from: "mediaSession", key: "title" },
        artist: { from: "mediaSession", key: "artist" },
        album: { from: "mediaSession", key: "album" },
        cover:{ from: "mediaSession", key: "artwork" },
        domTitle: { from: "selector", selector: "[data-testid=miniplayer_container] [data-testid=item_title]" },
        domCover: { from: "selector", selector: "[data-testid=miniplayer_container] [data-testid=item_cover] img", attr: "src" }
    },
    pages: [
        {
            when: [{ field: "title", exists: true }],
            details: "{title}",
            state: "{artist}",
            largeImage: "{cover|domCover}",
            largeText: "{album}",
            media: true
        },
        {
            when: [{ field: "domTitle", exists: true }],
            details: "{domTitle}",
            largeImage: "{domCover}",
            media: true
        }
    ]
};

export default rule;
