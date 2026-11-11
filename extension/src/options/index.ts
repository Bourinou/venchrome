import type { PreviewResult, UiToWorker } from "../messages.ts";
import { ruleMatchesHost } from "../rules/match.ts";
import { presets } from "../presets/index.ts";
import type { Rule } from "../rules/types.ts";
import { deleteRule, getRules, loadState, saveRule } from "../storage.ts";
import { el, presenceLines } from "../ui.ts";
import {
    MEDIA_KEYS, SOURCE_KINDS, newRuleForm, ruleFromForm, ruleToForm, validateForm,
    type CondForm, type FieldForm, type PageForm, type RuleForm
} from "./form.ts";

const app = document.getElementById("app")!;
app.className = "options";
const presetIds = new Set(presets.map(p => p.id));

/* ---------- helpers ---------- */

function text(label: string, value: string, set: (v: string) => void, opts: { area?: boolean; hint?: string } = {}) {
    const input = opts.area ? el("textarea", { rows: 3, value }) : el("input", { type: "text", value });
    input.addEventListener("input", () => set(input.value));
    return el("label", { class: "field" }, el("span", {}, opts.hint ? `${label} — ${opts.hint}` : label), input);
}

function check(label: string, value: boolean, set: (v: boolean) => void) {
    const input = el("input", { type: "checkbox", checked: value });
    input.addEventListener("change", () => set(input.checked));
    return el("label", { class: "row" }, input, label);
}

function select(label: string, value: string, options: [string, string][], set: (v: string) => void) {
    const s = el("select", {}, ...options.map(([v, t]) => el("option", { value: v, textContent: t, selected: v === value })));
    s.addEventListener("change", () => set(s.value));
    return el("label", { class: "field" }, el("span", {}, label), s);
}

/* ---------- list ---------- */

async function showList() {
    const [rules, state] = await Promise.all([getRules(), loadState()]);
    const newDomain = el("input", { type: "text", placeholder: "example.com" });
    const create = () => {
        const f = newRuleForm(newDomain.value, rules.map(r => r.id));
        void showEditor(f, true);
    };
    app.replaceChildren(
        el("h1", {}, "Venchrome rules"),
        el("div", { class: "row" },
            el("div", { class: "grow" }, newDomain),
            el("button", { class: "primary", onclick: create }, "New rule")),
        ...rules.map(r => ruleCard(r, rules, state.overrides))
    );
}

function ruleCard(r: Rule, rules: Rule[], overrides: Record<string, unknown>) {
    const isPreset = presetIds.has(r.id);
    const toggle = el("input", { type: "checkbox", checked: r.enabled });
    toggle.addEventListener("change", () => void saveRule({ ...r, enabled: toggle.checked }).then(showList));
    const actions: HTMLElement[] = [
        el("button", { onclick: () => void showEditor(ruleToForm(r), false) }, "Edit"),
        el("button", {
            onclick: () => {
                const id = (() => { let i = 2; while (rules.some(x => x.id === `${r.id}-${i}`)) i++; return `${r.id}-${i}`; })();
                void saveRule({ ...r, id, name: `${r.name} (copy)` }).then(showList);
            }
        }, "Duplicate")
    ];
    if (isPreset && overrides[r.id]) actions.push(el("button", { onclick: () => void deleteRule(r.id).then(showList) }, "Reset"));
    if (!isPreset) actions.push(el("button", { class: "danger", onclick: () => void deleteRule(r.id).then(showList) }, "Delete"));
    return el("div", { class: "card row" },
        toggle,
        el("div", { class: "grow" },
            el("strong", {}, r.name), " ",
            el("span", { class: "badge" }, isPreset ? "preset" : "custom"), " ",
            overrides[r.id] ? el("span", { class: "badge" }, "modified") : null,
            el("div", { class: "muted" }, r.hosts.join(", "))),
        ...actions);
}

/* ---------- editor ---------- */

async function showEditor(form: RuleForm, isNew: boolean) {
    const errors = el("div", { class: "error" });
    const fieldsBox = el("div");
    const pagesBox = el("div");
    const domBox = el("div");

    const renderFields = () => fieldsBox.replaceChildren(...form.fields.map((f, i) => fieldRow(f, () => {
        form.fields.splice(i, 1); renderFields();
    })));
    const renderPages = () => pagesBox.replaceChildren(...form.pages.map((p, i) => pageCard(p, i, form, () => {
        form.pages.splice(i, 1); renderPages();
    }, renderPages)));
    const renderDom = () => {
        const d = form.domMedia;
        domBox.replaceChildren(d
            ? el("div", { class: "card" },
                text("Paused element selector", d.pausedSelector, v => (d.pausedSelector = v), { hint: "present = paused" }),
                text("Progress element selector", d.progressSelector, v => (d.progressSelector = v)),
                text("Elapsed seconds attribute", d.currentAttr, v => (d.currentAttr = v)),
                text("Total seconds attribute", d.maxAttr, v => (d.maxAttr = v)),
                el("button", { class: "danger", onclick: () => { form.domMedia = null; renderDom(); } }, "Remove DOM media"))
            : el("button", {
                onclick: () => {
                    form.domMedia = { pausedSelector: "", progressSelector: "", currentAttr: "", maxAttr: "" }; renderDom();
                }
            }, "Add DOM media source"));
    };
    renderFields(); renderPages(); renderDom();

    const preview = previewPanel(form, errors);

    const save = async () => {
        const e = validateForm(form);
        errors.textContent = e.join("\n");
        if (e.length) return;
        await saveRule(ruleFromForm(form));
        await showList();
    };

    app.replaceChildren(
        el("h1", {}, `${isNew ? "New rule" : "Edit"}: ${form.name || form.id}`),
        text("Name (activity name on Discord)", form.name, v => (form.name = v)),
        text("Hosts", form.hosts, v => (form.hosts = v), { area: true, hint: "one per line; name without TLD matches any TLD, e.g. anime-sama" }),
        select("Activity type", form.activityType, [["0", "Playing"], ["2", "Listening to"], ["3", "Watching"]], v => (form.activityType = v)),
        text("Logo URL", form.logo, v => (form.logo = v), { hint: "https, optional" }),
        check("Enabled", form.enabled, v => (form.enabled = v)),
        el("h2", {}, "Fields"),
        fieldsBox,
        el("button", {
            onclick: () => { form.fields.push({ name: "", from: "selector", p1: "", p2: "" }); renderFields(); }
        }, "Add field"),
        el("h2", {}, "DOM media"),
        domBox,
        el("h2", {}, "Pages (first match wins)"),
        pagesBox,
        el("button", { onclick: () => { form.pages.push(blankPage()); renderPages(); } }, "Add page"),
        el("h2", {}, "Live preview"),
        preview,
        errors,
        el("div", { class: "row" },
            el("button", { class: "primary", onclick: () => void save() }, "Save"),
            el("button", { onclick: () => void showList() }, "Cancel"))
    );
}

const blankPage = (): PageForm => ({
    path: "", when: [], details: "", state: "", largeImage: "", largeText: "", buttonLabel: "", buttonUrl: "", media: false
});

function fieldRow(f: FieldForm, remove: () => void) {
    const p1Label = { selector: "CSS selector", meta: "Meta name/property", title: "Regex on title", url: "Regex on URL", mediaSession: "Media key" }[f.from];
    const p2Label = f.from === "selector" ? "Attribute (optional)" : "Capture group (optional)";
    const rest = el("div", { class: "row" });
    const draw = () => {
        const p1 = f.from === "mediaSession"
            ? select(p1Label, f.p1 || MEDIA_KEYS[0], MEDIA_KEYS.map(k => [k, k]), v => (f.p1 = v))
            : text(p1Label, f.p1, v => (f.p1 = v));
        if (f.from === "mediaSession" && !f.p1) f.p1 = MEDIA_KEYS[0];
        const parts: HTMLElement[] = [el("div", { class: "grow" }, p1)];
        if (f.from === "selector" || f.from === "title" || f.from === "url")
            parts.push(el("div", { class: "grow" }, text(p2Label, f.p2, v => (f.p2 = v))));
        rest.replaceChildren(...parts);
    };
    draw();
    const kind = select("Source", f.from, SOURCE_KINDS.map(k => [k, k]), v => {
        f.from = v as FieldForm["from"]; f.p1 = ""; f.p2 = "";
        // Re-render this row in place with fresh labels.
        row.replaceWith(fieldRow(f, remove));
    });
    const row: HTMLElement = el("div", { class: "card" },
        el("div", { class: "row" },
            el("div", { class: "grow" }, text("Field name", f.name, v => (f.name = v))),
            el("div", { class: "grow" }, kind),
            el("button", { class: "danger", onclick: remove }, "Remove")),
        rest);
    return row;
}

function condRow(c: CondForm, remove: () => void) {
    return el("div", { class: "row" },
        el("div", { class: "grow" }, text("Field", c.field, v => (c.field = v))),
        el("div", { class: "grow" }, select("Exists", c.exists, [["", "(ignore)"], ["true", "must exist"], ["false", "must be empty"]], v => (c.exists = v as CondForm["exists"]))),
        el("div", { class: "grow" }, text("Matches regex", c.matches, v => (c.matches = v))),
        el("button", { class: "danger", onclick: remove }, "×"));
}

function pageCard(p: PageForm, i: number, form: RuleForm, remove: () => void, redraw: () => void) {
    const whenBox = el("div");
    const drawWhen = () => whenBox.replaceChildren(...p.when.map((c, j) => condRow(c, () => { p.when.splice(j, 1); drawWhen(); })));
    drawWhen();
    const move = (d: number) => {
        const j = i + d;
        if (j < 0 || j >= form.pages.length) return;
        [form.pages[i], form.pages[j]] = [form.pages[j], form.pages[i]];
        redraw();
    };
    return el("div", { class: "card" },
        el("div", { class: "row" },
            el("strong", { class: "grow" }, `Page ${i + 1}`),
            el("button", { onclick: () => move(-1) }, "↑"),
            el("button", { onclick: () => move(1) }, "↓"),
            el("button", { class: "danger", onclick: remove }, "Remove")),
        text("Path regex", p.path, v => (p.path = v), { hint: "tested on location.pathname; empty = any" }),
        el("span", { class: "muted" }, "Conditions (all must pass)"),
        whenBox,
        el("button", { onclick: () => { p.when.push({ field: "", exists: "true", matches: "" }); drawWhen(); } }, "Add condition"),
        text("Details", p.details, v => (p.details = v), { hint: "template, e.g. {title|docTitle}" }),
        text("State", p.state, v => (p.state = v)),
        text("Large image", p.largeImage, v => (p.largeImage = v)),
        text("Large image text", p.largeText, v => (p.largeText = v)),
        el("div", { class: "row" },
            el("div", { class: "grow" }, text("Button label", p.buttonLabel, v => (p.buttonLabel = v))),
            el("div", { class: "grow" }, text("Button URL", p.buttonUrl, v => (p.buttonUrl = v), { hint: "https" }))),
        check("Use media state (timestamps, pause)", p.media, v => (p.media = v)));
}

/* ---------- live preview ---------- */

function previewPanel(form: RuleForm, errors: HTMLElement) {
    const tabSelect = el("select", {});
    const out = el("pre", {}, "Pick a tab and press Preview.");
    const loadTabs = async () => {
        const rule = ruleFromForm(form);
        const tabs = (await chrome.tabs.query({})).filter(t => {
            try { return t.id !== undefined && t.url && ruleMatchesHost(rule, new URL(t.url).hostname); } catch { return false; }
        });
        tabSelect.replaceChildren(...tabs.map(t => el("option", { value: String(t.id), textContent: t.title ?? t.url ?? String(t.id) })));
        if (!tabs.length) tabSelect.append(el("option", { value: "", textContent: "(no open tab matches these hosts)" }));
    };
    const run = async () => {
        const e = validateForm(form);
        errors.textContent = e.join("\n");
        if (e.length) return;
        if (!tabSelect.value) return void (out.textContent = "No matching tab.");
        const msg: UiToWorker = { type: "preview", rule: ruleFromForm(form), tabId: Number(tabSelect.value) };
        const res = (await chrome.runtime.sendMessage(msg)) as PreviewResult | undefined;
        if (!res) return void (out.textContent = "No answer from the extension worker.");
        if (res.error) return void (out.textContent = `Error: ${res.error}\n(reload the tab if the content script is missing)`);
        if (!res.matched) return void (out.textContent = "The tab hostname does not match this rule.");
        out.textContent =
            "Fields:\n" + (Object.entries(res.fields).map(([k, v]) => `  ${k} = ${v}`).join("\n") || "  (none)") +
            "\n\nPresence:\n" + presenceLines(res.presence);
    };
    return el("div", {},
        el("div", { class: "row" },
            el("div", { class: "grow" }, tabSelect),
            el("button", { onclick: () => void loadTabs() }, "Refresh tabs"),
            el("button", { onclick: () => void run() }, "Preview")),
        out,
        (void loadTabs(), null));
}

void showList();
