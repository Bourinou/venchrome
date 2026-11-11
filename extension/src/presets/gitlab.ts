// GitLab (D-007). Any host with a "gitlab" label (gitlab.com, gitlab.example.org).
// The only reliable public signal is the project visibility icon (project pages); issue and
// merge request pages carry none, so they stay generic (no project name) - safe default.
import type { Rule } from "../rules/types.ts";

const PROJECT = "^/[^/]+/[^/]+";
const isPublic = [{ field: "vis", matches: "^Public" }, { field: "project", exists: true }];
const button = { label: "View on GitLab", url: "{url}" };

const preset: Rule = {
    id: "gitlab",
    name: "GitLab",
    enabled: true,
    hosts: ["gitlab"],
    activityType: 0,
    logo: "https://gitlab.com/favicon.ico",
    fields: {
        vis: { from: "selector", selector: ".visibility-icon", attr: "title" },
        project: { from: "selector", selector: "body", attr: "data-project-full-path" }
    },
    pages: [
        { when: isPublic, details: "{project}", state: "Browsing the project", button },
        { when: [{ field: "vis", matches: "^Private|^Internal" }], details: "Working on a private repo" },
        { path: `${PROJECT}/-/merge_requests/\\d+`, details: "Reviewing a merge request" },
        { path: `${PROJECT}/-/issues/\\d+`, details: "Reading an issue" },
        { details: "Browsing GitLab" }
    ]
};

export default preset;
