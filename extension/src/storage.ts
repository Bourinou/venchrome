// Rules = presets + user overrides (top-level diff vs the preset) + custom rules, in chrome.storage.local.
import { presets } from "./presets/index.ts";
import type { Rule } from "./rules/types.ts";

export type RuleOverride = Partial<Omit<Rule, "id">>;

export interface StoredState {
    /** Global on/off. */
    enabled: boolean;
    /** Preset id → changed top-level keys. */
    overrides: Record<string, RuleOverride>;
    customRules: Rule[];
}

export const DEFAULT_STATE: StoredState = { enabled: true, overrides: {}, customRules: [] };
const KEYS = Object.keys(DEFAULT_STATE) as (keyof StoredState)[];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Pure. Presets with their overrides applied, then custom rules (a custom id equal to a preset id is ignored). */
export function mergeRules(base: Rule[], overrides: Record<string, RuleOverride>, custom: Rule[]): Rule[] {
    const ids = new Set(base.map(r => r.id));
    return [
        ...base.map(r => ({ ...r, ...overrides[r.id], id: r.id })),
        ...custom.filter(r => !ids.has(r.id))
    ];
}

/** Pure. Top-level keys of `edited` that differ from `preset`. */
export function diffRule(preset: Rule, edited: Rule): RuleOverride {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(edited) as (keyof Rule)[])
        if (k !== "id" && !same(preset[k], edited[k])) out[k] = edited[k];
    return out as RuleOverride;
}

export async function loadState(): Promise<StoredState> {
    const got = await chrome.storage.local.get(KEYS);
    return { ...DEFAULT_STATE, ...got } as StoredState;
}

export async function getRules(): Promise<Rule[]> {
    const s = await loadState();
    return mergeRules(presets, s.overrides, s.customRules);
}

export async function setEnabled(enabled: boolean): Promise<void> {
    await chrome.storage.local.set({ enabled });
}

/** Save a rule: preset → stored as diff, otherwise as custom rule (added or replaced). */
export async function saveRule(rule: Rule): Promise<void> {
    const s = await loadState();
    const preset = presets.find(p => p.id === rule.id);
    if (preset) {
        const diff = diffRule(preset, rule);
        const overrides = { ...s.overrides };
        if (Object.keys(diff).length) overrides[rule.id] = diff;
        else delete overrides[rule.id];
        await chrome.storage.local.set({ overrides });
    } else {
        await chrome.storage.local.set({ customRules: [...s.customRules.filter(r => r.id !== rule.id), rule] });
    }
}

/** Custom rule: deleted. Preset: reset to defaults. */
export async function deleteRule(id: string): Promise<void> {
    const s = await loadState();
    const { [id]: _, ...overrides } = s.overrides;
    await chrome.storage.local.set({ overrides, customRules: s.customRules.filter(r => r.id !== id) });
}

/** Calls `cb` with the new state whenever a stored key changes. Returns an unsubscribe function. */
export function onStateChange(cb: (state: StoredState) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area === "local" && KEYS.some(k => k in changes)) void loadState().then(cb);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
}
