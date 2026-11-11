import { describe, expect, it } from "vitest";
import animeSama from "../../src/presets/anime-sama.ts";
import { findRule } from "../../src/rules/match.ts";
import { presenceFor } from "./load.ts";

const EP = "/catalogue/one-piece/saison1/vostfr/";

describe("anime-sama preset", () => {
    it("episode: anime, season, episode, language, cover; no progress (iframe)", () => {
        const p = presenceFor(animeSama, "anime-sama/episode.html", "https://anime-sama.to" + EP);
        expect(p).toMatchObject({
            details: "One Piece", state: "Saga 1 (East Blue) · Episode 2 · vostfr",
            largeImage: "https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/one-piece.jpg"
        });
        expect(p?.startTimestamp).toBeUndefined();
    });
    it("matches any TLD", () => {
        for (const h of ["anime-sama.to", "anime-sama.fr", "anime-sama.si", "www.anime-sama.org"])
            expect(findRule([animeSama], h)?.id).toBe("anime-sama");
        expect(findRule([animeSama], "notanime-sama.to")).toBeUndefined();
        expect(presenceFor(animeSama, "anime-sama/episode.html", "https://anime-sama.fr" + EP)?.details).toBe("One Piece");
    });
    it("catalogue: Browsing", () => {
        expect(presenceFor(animeSama, "anime-sama/catalogue.html", "https://anime-sama.to/catalogue/")?.details).toBe("Browsing");
    });
});
