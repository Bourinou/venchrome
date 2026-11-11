// MAIN world: what the isolated world cannot see. Talks to it through DOM CustomEvents carrying JSON strings
// (objects do not cross worlds). Generic: no site-specific code.
import { EV_MEDIA_SESSION, EV_MEDIA_SESSION_GET, EV_URL_CHANGE } from "./events.ts";

function readSession(): string {
    const m = navigator.mediaSession?.metadata;
    if (!m) return "null";
    const art = m.artwork?.length ? m.artwork[m.artwork.length - 1].src : undefined;
    return JSON.stringify({ title: m.title || undefined, artist: m.artist || undefined, album: m.album || undefined, artwork: art });
}

const emitSession = () => document.dispatchEvent(new CustomEvent(EV_MEDIA_SESSION, { detail: readSession() }));

document.addEventListener(EV_MEDIA_SESSION_GET, emitSession);

// Notify when a page sets new metadata.
const desc = typeof MediaSession !== "undefined" ? Object.getOwnPropertyDescriptor(MediaSession.prototype, "metadata") : undefined;
if (desc?.set && desc.get) {
    const { get, set } = desc;
    Object.defineProperty(MediaSession.prototype, "metadata", {
        ...desc,
        get,
        set(v: MediaMetadata | null) {
            set.call(this, v);
            queueMicrotask(emitSession);
        }
    });
}

// SPA navigations: pushState/replaceState are invisible to the isolated world.
for (const k of ["pushState", "replaceState"] as const) {
    const orig = history[k];
    history[k] = function (this: History, ...args: Parameters<History["pushState"]>) {
        const r = orig.apply(this, args);
        document.dispatchEvent(new CustomEvent(EV_URL_CHANGE));
        return r;
    };
}

emitSession();
