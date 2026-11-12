import type { Rule } from "../rules/types.ts";

// Live: /<login>; VOD: /videos/<id>. mediaSession title = stream/VOD title, artist = channel.
const twitch: Rule = {
    id: "twitch",
    name: "Twitch",
    enabled: true,
    hosts: ["twitch"],
    activityType: 3,
    logo: "https://www.google.com/s2/favicons?domain=twitch.tv&sz=128",
    fields: {
        msTitle: { from: "mediaSession", key: "title" },
        msArtist: { from: "mediaSession", key: "artist" },
        streamTitle: { from: "selector", selector: "[data-a-target=\"stream-title\"]" },
        channelName: { from: "selector", selector: "h1.tw-title" },
        avatar: { from: "selector", selector: ".channel-info-content img.tw-image-avatar", attr: "src" },
        game:{ from: "selector", selector: "[data-a-target=\"stream-game-link\"]" },
        login: { from: "url", regex: "^https://[^/]+/(?!videos/|directory|search|settings|downloads|p/)([A-Za-z0-9_]+)/?(?:[?#]|$)" }
    },
    pages: [
        {
            path: "^/videos/\\d+",
            when: [{ field: "msTitle", exists: true }],
            details: "{msTitle}",
            state: "{msArtist|channelName}",
            largeText: "{msTitle}",
            button: { label: "Open channel", url: "https://www.twitch.tv/{msArtist|channelName}" },
            media: true
        },
        {
            when: [{ field: "login", exists: true }],
            details: "{msTitle|streamTitle}",
            state: "{msArtist|channelName|login} — {game}",
            largeImage: "{avatar}",
            largeText: "{game}",
            button: { label: "Watch live", url: "https://www.twitch.tv/{login}" },
            media: true
        },
        { details: "Browsing" }
    ]
};

export default twitch;
