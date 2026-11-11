// Pure: which tab drives the presence (D-005) and payload comparison (D-011).
import type { PresencePayload } from "../../../plugin/venchrome/protocol.ts";

export interface Candidate {
    tabId: number;
    ruleId: string;
    presence: PresencePayload;
    /** A media is playing in this tab. */
    playing: boolean;
    /** ms epoch of the last time this tab was brought to the foreground (or first seen). */
    focusedAt: number;
    /** ms epoch of the last sign of life (`update` / `alive`), D-006. */
    aliveAt: number;
}

/** Most recent focus wins; ties broken by the higher tabId (deterministic). */
const newer = (a: Candidate, b: Candidate) => a.focusedAt - b.focusedAt || a.tabId - b.tabId;

/** D-005: a playing tab wins, otherwise the most recently focused one. */
export function pickDriver(candidates: Candidate[]): Candidate | null {
    const playing = candidates.filter(c => c.playing);
    const pool = playing.length ? playing : candidates;
    return pool.reduce<Candidate | null>((best, c) => (!best || newer(c, best) > 0 ? c : best), null);
}

/** Deep equality, key order independent. */
export function samePayload(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a).filter(k => (a as Record<string, unknown>)[k] !== undefined);
    const kb = Object.keys(b).filter(k => (b as Record<string, unknown>)[k] !== undefined);
    return ka.length === kb.length && ka.every(k => samePayload((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
