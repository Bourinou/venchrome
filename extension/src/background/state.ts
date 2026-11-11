// Worker state in chrome.storage.session: survives the worker sleeping, not the browser closing.
import type { PresencePayload } from "../../../plugin/venchrome/protocol.ts";
import type { Candidate } from "./arbiter.ts";

export interface SessionState {
    /** tabId (as string) → candidate. */
    candidates: Record<string, Candidate>;
    /** Last payload sent to the plugin on the current connection (null = cleared / nothing sent). */
    sent: PresencePayload | null;
}

const DEFAULT: SessionState = { candidates: {}, sent: null };
const KEYS = Object.keys(DEFAULT) as (keyof SessionState)[];

export async function loadSession(): Promise<SessionState> {
    return { ...DEFAULT, ...(await chrome.storage.session.get(KEYS)) } as SessionState;
}

export async function saveSession(patch: Partial<SessionState>): Promise<void> {
    await chrome.storage.session.set(patch);
}

/** Serialised read-modify-write so concurrent events don't lose updates. */
let queue: Promise<unknown> = Promise.resolve();
export function updateCandidates(fn: (c: Record<string, Candidate>) => void): Promise<Record<string, Candidate>> {
    const run = queue.then(async () => {
        const { candidates } = await loadSession();
        fn(candidates);
        await saveSession({ candidates });
        return candidates;
    });
    queue = run.catch(() => {});
    return run;
}
