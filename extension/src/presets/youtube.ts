import type { Rule } from "../rules/types.ts";

// mediaSession first (follows SPA navigation); title/DOM as fallbacks. Video id from the URL (D: YouTube keeps stale DOM).
const youtube: Rule = {
    id: "youtube",
    name: "YouTube",
    enabled: true,
    hosts: ["youtube"],
    activityType: 3,
    logo: "https://www.google.com/s2/favicons?domain=youtube.com&sz=128",
    fields: {
        videoId: { from: "url", regex: "(?:[?&]v=|/shorts/|/live/)([\\w-]{11})" },
        msTitle: { from: "mediaSession", key: "title" },
        msArtist: { from: "mediaSession", key: "artist" },
        docTitle: { from: "title", regex: "^(?:\\(\\d+\\) )?(.+) - YouTube$" },
        channel: { from: "selector", selector: "ytd-video-owner-renderer #channel-name a" }
    },
    pages: [
        {
            path: "^/(watch|shorts/|live/)",
            when: [{ field: "videoId", exists: true }],
            details: "{msTitle|docTitle}",
            state: "{msArtist|channel}",
            largeImage: "https://i.ytimg.com/vi/{videoId}/hqdefault.jpg",
            largeText: "{msTitle|docTitle}",
            button: { label: "Watch on YouTube", url: "https://www.youtube.com/watch?v={videoId}" },
            media: true
        },
        { details: "Browsing" }
    ]
};

export default youtube;
