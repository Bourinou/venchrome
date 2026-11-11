import { describe, expect, it } from "vitest";
import gitlab from "../../src/presets/gitlab.ts";
import { presenceFor } from "./helpers.ts";

const at = (f: string, path: string, host = "gitlab.com") => presenceFor(gitlab, `gitlab/${f}.html`, `https://${host}${path}`)!;

describe("gitlab preset", () => {
    it("public project: name and button", () => {
        const p = at("public-project", "/demo-group/demo-project");
        expect(p.details).toBe("demo-group/demo-project");
        expect(p.buttons).toEqual([{ label: "View on GitLab", url: "https://gitlab.com/demo-group/demo-project" }]);
    });
    it("works on self-hosted gitlab.* instances", () => {
        expect(at("public-project", "/demo-group/demo-project", "gitlab.example.org").details).toBe("demo-group/demo-project");
    });
    it("private project: no name, no button", () => {
        const p = at("private-project", "/demo-group/secret-project");
        expect(p.details).toBe("Working on a private repo");
        expect(p.buttons).toBeUndefined();
        expect(JSON.stringify(p)).not.toMatch(/secret-project/);
    });
    it("merge request without visibility signal stays generic", () => {
        const p = at("merge-request", "/demo-group/secret-project/-/merge_requests/7");
        expect(p.details).toBe("Reviewing a merge request");
        expect(p.buttons).toBeUndefined();
        expect(JSON.stringify(p)).not.toMatch(/secret-project/);
    });
    it("home", () => {
        expect(at("home", "/").details).toBe("Browsing GitLab");
    });
});
