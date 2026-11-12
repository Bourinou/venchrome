// PresencePayload -> Discord activity. Pure, no Vencord import: shape mirrors
// @vencord/discord-types Activity as used by customRPC (checked upstream).
import { ActivityType, PresencePayload } from "./protocol";

export interface DiscordActivity {
    application_id: string;
    name: string;
    type: ActivityType;
    flags: number;
    details?: string;
    state?: string;
    timestamps?: { start?: number; end?: number; };
    assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string; };
    buttons?: string[];
    metadata?: { button_urls?: string[]; };
}

/** Image values are left raw (https URL or asset key); the caller resolves them to asset ids. */
export function toActivity(p: PresencePayload, appId: string): DiscordActivity {
    const activity: DiscordActivity = {
        application_id: appId,
        name: p.name,
        type: p.type,
        flags: 1 << 0 // INSTANCE, like customRPC
    };
    if (p.details) activity.details = p.details;
    if (p.state) activity.state = p.state;

    if (p.startTimestamp || p.endTimestamp) {
        activity.timestamps = {};
        if (p.startTimestamp) activity.timestamps.start = p.startTimestamp;
        if (p.endTimestamp) activity.timestamps.end = p.endTimestamp;
    }

    const assets: NonNullable<DiscordActivity["assets"]> = {};
    if (p.largeImage) assets.large_image = p.largeImage;
    if (p.largeText) assets.large_text = p.largeText;
    if (p.smallImage) assets.small_image = p.smallImage;
    if (p.smallText) assets.small_text = p.smallText;
    if (Object.keys(assets).length) activity.assets = assets;

    const buttons = (p.buttons ?? []).filter(b => b.label && b.url).slice(0, 2);
    if (buttons.length) {
        activity.buttons = buttons.map(b => b.label);
        activity.metadata = { button_urls: buttons.map(b => b.url) };
    }
    return activity;
}

/** New track/page/site or a clear (not just timing or play state): sent ~1 s after it settles (D-023). */
export function contentChanged(a: PresencePayload | null, b: PresencePayload | null) {
    return !a || !b || a.name !== b.name || a.details !== b.details || a.state !== b.state;
}
