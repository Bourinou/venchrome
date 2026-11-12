import { mkdtempSync, mkdirSync, realpathSync, lstatSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM hook without types
import { linkPlugin } from "../../vencord-hook/50-venchrome.mjs";

const type = process.platform === "win32" ? "junction" : "dir";

function setup() {
    const tmp = mkdtempSync(join(tmpdir(), "venchrome-hook-"));
    const repo = join(tmp, "repo");
    mkdirSync(join(repo, "plugin", "venchrome"), { recursive: true });
    return { tmp, repo, vencord: join(tmp, "vencord") };
}

describe("vencord hook", () => {
    it("creates then keeps the link", () => {
        const { repo, vencord } = setup();
        expect(linkPlugin(vencord, repo)).toBe("created");
        expect(linkPlugin(vencord, repo)).toBe("unchanged");
        const link = join(vencord, "src", "userplugins", "venchrome");
        expect(realpathSync(link)).toBe(realpathSync(join(repo, "plugin", "venchrome")));
    });

    it("replaces a wrong link", () => {
        const { tmp, repo, vencord } = setup();
        const other = join(tmp, "other");
        mkdirSync(other);
        mkdirSync(join(vencord, "src", "userplugins"), { recursive: true });
        const link = join(vencord, "src", "userplugins", "venchrome");
        symlinkSync(other, link, type);
        expect(linkPlugin(vencord, repo)).toBe("replaced");
        expect(lstatSync(link).isSymbolicLink()).toBe(true);
        expect(realpathSync(link)).toBe(realpathSync(join(repo, "plugin", "venchrome")));
    });

    it("fails when the plugin folder is missing", () => {
        const { tmp, vencord } = setup();
        expect(() => linkPlugin(vencord, join(tmp, "nope"))).toThrow();
    });
});
