// claude.ai (D-007): fixed text only. No field is extracted, so no page text can reach Discord.
import type { Rule } from "../rules/types.ts";

const preset: Rule = {
    id: "claude",
    name: "Claude",
    enabled: true,
    hosts: ["claude.ai"],
    activityType: 0,
    logo: "https://www.google.com/s2/favicons?domain=claude.ai&sz=128",
    fields: {},
    pages: [{ details: "Chatting with Claude" }]
};

export default preset;
