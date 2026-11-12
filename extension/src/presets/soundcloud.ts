import type { Rule } from "../rules/types.ts";

// SoundCloud: persistent player at the bottom; paused = play button without the `playing` class.
const BADGE = ".playbackSoundBadge";

const rule: Rule = {
    id: "soundcloud",
    name: "SoundCloud",
    enabled: true,
    hosts: ["soundcloud"],
    activityType: 2,
    logo: "https://www.google.com/s2/favicons?domain=soundcloud.com&sz=128",
    domMedia: {
        pausedSelector: ".playControls__play:not(.playing)",
        progressSelector: ".playbackTimeline__progressWrapper",
        currentAttr: "aria-valuenow",
        maxAttr: "aria-valuemax"
    },
    fields: {
        title: { from: "selector", selector: `${BADGE}__titleLink`, attr: "title" },
        artist: { from: "selector", selector: `${BADGE}__lightLink`, attr: "title" },
        path: { from: "selector", selector: `${BADGE}__titleLink`, attr: "href" },
        album: { from: "mediaSession", key: "album" },
        cover: { from: "mediaSession", key: "artwork" }
    },
    pages: [
        {
            when: [{ field: "title", exists: true }],
            details: "{title}",
            state: "{artist}",
            largeImage: "{cover}",
            largeText: "{album}",
            button: { label: "Listen on SoundCloud", url: "https://soundcloud.com{path}" },
            media: true
        }
    ]
};

export default rule;
