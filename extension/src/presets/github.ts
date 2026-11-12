// GitHub (D-007): the repo name is shown only when the page says the repo is public.
// Public signals: meta octolytics-dimension-repository_public (issues, PRs, ...) or the visibility label (repo pages).
// Anything else (private, unknown, signed out) falls back to generic text.
import type { Rule } from "../rules/types.ts";

const REPO = "^/[^/]+/[^/]+";
const publicMeta = [{ field: "pub", matches: "^true$" }, { field: "repo", exists: true }];
const publicLabel = [{ field: "vis", matches: "^Public" }, { field: "repo", exists: true }];
// Top-level paths that are not user/org profiles.
const RESERVED = "settings|notifications|explore|marketplace|pulls|issues|topics|trending|codespaces|sponsors|login|logout|signup|new|organizations|orgs|features|search|dashboard|copilot|collections|events|about|pricing|enterprise|team|security|apps|stars|watching";
const button = { label: "View on GitHub", url: "{url}" };

const preset: Rule = {
    id: "github",
    name: "GitHub",
    enabled: true,
    hosts: ["github.com"],
    activityType: 0,
    logo: "https://www.google.com/s2/favicons?domain=github.com&sz=128",
    fields: {
        pub: { from: "meta", name: "octolytics-dimension-repository_public" },
        vis: { from: "selector", selector: "[data-testid=\"repo-visibility-label\"]" },
        repo: { from: "meta", name: "octolytics-dimension-repository_nwo" },
        num: { from: "url", regex: "/(?:issues|pull)/(\\d+)" },
        user: { from: "url", regex: `^https://github\\.com/(?!(?:${RESERVED})(?:[/?#]|$))([A-Za-z0-9-]+)/?(?:[?#]|$)` }
    },
    pages: [
        { path: `${REPO}/issues/\\d+`, when: publicMeta, details: "{repo}", state: "Issue #{num}", button },
        { path: `${REPO}/pull/\\d+`, when: publicMeta, details: "{repo}", state: "Pull request #{num}", button },
        { path: `${REPO}/(?:blob|tree)/`, when: publicMeta, details: "{repo}", state: "Browsing code", button },
        { path: `${REPO}/(?:blob|tree)/`, when: publicLabel, details: "{repo}", state: "Browsing code", button },
        { path: `${REPO}(?:/|$)`, when: publicMeta, details: "{repo}", state: "Browsing the repository", button },
        { path: `${REPO}(?:/|$)`, when: publicLabel, details: "{repo}", state: "Browsing the repository", button },
        { path: `${REPO}(?:/|$)`, when: [{ field: "pub", matches: "^false$" }], details: "Working on a private repo" },
        { path: `${REPO}(?:/|$)`, when: [{ field: "vis", matches: "^Private" }], details: "Working on a private repo" },
        { when: [{ field: "user", exists: true }], details: "Viewing a profile", state: "{user}", button },
        { details: "Browsing GitHub" }
    ]
};

export default preset;
