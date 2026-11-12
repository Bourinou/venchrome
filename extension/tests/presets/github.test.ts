import { describe, expect, it } from "vitest";
import github from "../../src/presets/github.ts";
import { presenceFor } from "./helpers.ts";

const at = (f: string, path: string) => presenceFor(github, `github/${f}.html`, `https://github.com${path}`)!;

describe("github preset", () => {
    it("public repo home: name, activity and button", () => {
        const p = at("public-repo", "/demo-org/demo-repo");
        expect(p.details).toBe("demo-org/demo-repo");
        expect(p.state).toBe("Browsing the repository");
        expect(p.buttons).toEqual([{ label: "View on GitHub", url: "https://github.com/demo-org/demo-repo" }]);
    });
    it("public code view", () => {
        expect(at("public-repo", "/demo-org/demo-repo/blob/main/a.ts").state).toBe("Browsing code");
    });
    it("issue and pull request", () => {
        expect(at("issue", "/demo-org/demo-repo/issues/12").state).toBe("Issue #12");
        expect(at("pull", "/demo-org/demo-repo/pull/34").state).toBe("Pull request #34");
    });
    it("private repo: no repo name, no button", () => {
        for (const [f, path] of [["private-repo", "/demo-org/secret-repo"], ["private-issue", "/demo-org/secret-repo/issues/5"]]) {
            const p = at(f, path);
            expect(p.details).toBe("Working on a private repo");
            expect(p.buttons).toBeUndefined();
            expect(JSON.stringify(p)).not.toMatch(/secret-repo/);
        }
    });
    it("unknown visibility on a repo path stays generic", () => {
        const p = at("home", "/demo-org/demo-repo");
        expect(p.details).toBe("Browsing GitHub");
        expect(p.buttons).toBeUndefined();
    });
    it("home", () => {
        expect(at("home", "/").details).toBe("Browsing GitHub");
    });
    it("user profile", () => {
        const p = at("home", "/octocat");
        expect(p.details).toBe("Viewing a profile");
        expect(p.state).toBe("octocat");
        expect(p.buttons).toEqual([{ label: "View on GitHub", url: "https://github.com/octocat" }]);
    });
    it("reserved top-level pages are not profiles", () => {
        for (const path of ["/settings", "/notifications", "/explore?x=1"]) expect(at("home", path).details).toBe("Browsing GitHub");
    });
});
