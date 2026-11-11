import type { Rule } from "../rules/types.ts";

// Player is a cross-origin iframe (D-013): no progress, title/season/episode/language only.
// Episode = selected option of #selectEpisodes (set by JS: `:checked` in Chrome; `[selected]` for happy-dom fixtures, which lack `option:checked`).
const animeSama: Rule = {
    id: "anime-sama",
    name: "Anime-Sama",
    enabled: true,
    hosts: ["anime-sama"],
    activityType: 3,
    fields: {
        anime: { from: "selector", selector: "#titreOeuvre" },
        season: { from: "selector", selector: "#avOeuvre" },
        episode: { from: "selector", selector: "#selectEpisodes option:checked, #selectEpisodes option[selected]" },
        lang: { from: "url", regex: "/catalogue/[^/]+/[^/]+/([a-z]+)/?" },
        cover: { from: "meta", name: "og:image" }
    },
    pages: [
        {
            path: "^/catalogue/[^/]+/[^/]+/[^/]+",
            when: [{ field: "anime", exists: true }],
            details: "{anime}",
            state: "{season} · {episode} · {lang}",
            largeImage: "{cover}",
            largeText: "{anime}"
        },
        { details: "Browsing" }
    ]
};

export default animeSama;
