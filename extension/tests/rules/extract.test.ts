import { describe, expect, it } from "vitest";
import { extractFields } from "../../src/rules/extract.ts";
import type { MediaSnapshot, Rule } from "../../src/rules/types.ts";

function makeDoc(html: string, title: string): Document {
    const doc = document.implementation.createHTMLDocument(title);
    doc.body.innerHTML = html;
    doc.title = title;
    return doc;
}

const rule: Rule = {
    id: "t", name: "T", enabled: true, hosts: ["t"], activityType: 3, pages: [],
    fields: {
        text: { from: "selector", selector: ".name" },
        href: { from: "selector", selector: "a.link", attr: "href" },
        missing: { from: "selector", selector: ".nope" },
        bad: { from: "selector", selector: "[[" },
        og: { from: "meta", name: "og:image" },
        desc: { from: "meta", name: "description" },
        ep: { from: "title", regex: "Episode (\\d+)" },
        vid: { from: "url", regex: "[?&]v=([^&]+)" },
        badRe: { from: "url", regex: "(" },
        song: { from: "mediaSession", key: "title" },
        art: { from: "mediaSession", key: "artwork" }
    }
};

describe("extractFields", () => {
    const doc = makeDoc(
        `<span class="name">  Hello
            world </span><a class="link" href="/x">x</a>`,
        "Show - Episode 12"
    );
    const m1 = doc.createElement("meta");
    m1.setAttribute("property", "og:image");
    m1.setAttribute("content", "https://img/1.png");
    const m2 = doc.createElement("meta");
    m2.setAttribute("name", "description");
    m2.setAttribute("content", "desc");
    doc.head.append(m1, m2);
    const media: MediaSnapshot = {
        paused: false, currentTime: 1, duration: 2, live: false,
        session: { title: "Song", artwork: "https://art/a.jpg" }
    };
    const f = extractFields(rule, doc, "https://www.t.com/watch?v=abc&t=1", media);

    it("reads selectors (text, attribute, missing, invalid)", () => {
        expect(f.text).toBe("Hello world");
        expect(f.href).toBe("/x");
        expect(f.missing).toBe("");
        expect(f.bad).toBe("");
    });
    it("reads meta by name or property", () => {
        expect(f.og).toBe("https://img/1.png");
        expect(f.desc).toBe("desc");
    });
    it("reads title and url regexes", () => {
        expect(f.ep).toBe("12");
        expect(f.vid).toBe("abc");
        expect(f.badRe).toBe("");
    });
    it("reads the mediaSession snapshot", () => {
        expect(f.song).toBe("Song");
        expect(f.art).toBe("https://art/a.jpg");
        expect(extractFields(rule, doc, "https://t.com/").song).toBe("");
    });
    it("adds built-ins", () => {
        expect(f.host).toBe("www.t.com");
        expect(f.title).toBe("Show - Episode 12");
        expect(f.url).toBe("https://www.t.com/watch?v=abc&t=1");
    });
});
