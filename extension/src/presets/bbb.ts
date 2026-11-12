// BigBlueButton (D-007, D-021): fixed text only; a meeting name may be private, so none is extracted by default.
// To show the room name, add to `fields`: room: { from: "title", regex: "^BigBlueButton - (.+)$" } and use details: "{room}".
// Match: any host label starting with "bbb" (bbb.example.org, bbb2.school.fr) AND the /html5client path.
import type { Rule } from "../rules/types.ts";

const preset: Rule = {
    id: "bbb",
    name: "BigBlueButton",
    enabled: true,
    hosts: ["bbb*"],
    activityType: 0,
    logo: "https://bigbluebutton.org/wp-content/uploads/2021/03/favicon.png",
    fields: {},
    pages: [{ path: "^/html5client", details: "In a BigBlueButton meeting" }]
};

export default preset;
