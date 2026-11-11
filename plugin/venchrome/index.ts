import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

import { DiscordActivity, toActivity } from "./activity";
import type { RendererUpdate } from "./native";
import { createThrottle } from "./throttle";

const Native = VencordNative.pluginHelpers.Venchrome as PluginNative<typeof import("./native")>;

const THROTTLE_MS = 15_000; // D-011
const SOCKET_ID = "Venchrome";

const settings = definePluginSettings({
    appId: {
        type: OptionType.STRING,
        description: "Discord application ID used for the presence (required)",
        default: ""
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
    const { appId } = settings.store;
    if (!appId) {
        console.warn("[Venchrome] No appId set in plugin settings: presence not shown.");
        return;
    }
    const activity = toActivity(update, appId);
    if (activity.assets) {
        activity.assets.large_image = await resolveAsset(appId, activity.assets.large_image);
        activity.assets.small_image = await resolveAsset(appId, activity.assets.small_image);
    }
    dispatch(activity);
}

const throttle = createThrottle<RendererUpdate>(u => {
    show(u).catch(err => console.error("[Venchrome]", err));
}, THROTTLE_MS);

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
