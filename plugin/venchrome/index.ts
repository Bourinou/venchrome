import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

import { DiscordActivity, toActivity } from "./activity";
import type { RendererUpdate } from "./native";
import { createThrottle } from "./throttle";

const Native = VencordNative.pluginHelpers.Venchrome as PluginNative<typeof import("./native")>;

const THROTTLE_MS = 5_000; // D-016 (was 15 s, D-011)
const SETTLE_MS = 1_500; // D-017: absorbs paused → playing on page load
const SOCKET_ID = "Venchrome";
const DEFAULT_APP_ID = "1570214212830232656"; // D-022 (public ID, amends D-004/D-015)

const settings = definePluginSettings({
    appId: {
        type: OptionType.STRING,
        description: "Discord application ID used for the presence (optional override)",
        default: DEFAULT_APP_ID
    }
});

function dispatch(activity: DiscordActivity | null) {
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity, socketId: SOCKET_ID });
}

async function resolveAsset(appId: string, image: string | undefined) {
    if (!image) return undefined;
    return (await ApplicationAssetUtils.fetchAssetIds(appId, [image]))[0];
}

async function show(update: RendererUpdate) {
    if (!update) return dispatch(null);
    const appId = settings.store.appId?.trim() || DEFAULT_APP_ID;
    const activity = toActivity(update, appId);
    if (activity.assets) {
        activity.assets.large_image = await resolveAsset(appId, activity.assets.large_image);
        activity.assets.small_image = await resolveAsset(appId, activity.assets.small_image);
    }
    dispatch(activity);
}

const throttle = createThrottle<RendererUpdate>(u => {
    show(u).catch(err => console.error("[Venchrome]", err));
}, THROTTLE_MS, undefined, SETTLE_MS);

export default definePlugin({
    name: "Venchrome",
    description: "Shows your Chrome activity on configured sites as a Discord Rich Presence",
    authors: [{ name: "Bourinou", id: 306785764476190720n }],
    settings,

    /** Called from native.ts through executeJavaScript. */
    onNativeUpdate(update: RendererUpdate) {
        throttle.push(update);
    },

    start() {
        Native.start();
    },

    stop() {
        throttle.cancel();
        dispatch(null);
        Native.stop();
    }
});
