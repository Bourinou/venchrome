// claude.ai (D-007): fixed text only. No field is extracted, so no page text can reach Discord.
import type { Rule } from "../rules/types.ts";

const preset: Rule = {
    id: "claude",
    name: "Claude",
    enabled: true,
    hosts: ["claude.ai"],
    activityType: 0,
    logo: "https://claude.ai/favicon.ico",
    fields: {},
    pages: [{ details: "Chatting with Claude" }]
};

export default preset;
