// Tiny DOM helpers shared by options and popup. Values are set as text / properties only, never parsed as markup.
import type { PresencePayload } from "../../plugin/venchrome/protocol.ts";
import "./ui.css";

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<Omit<HTMLElementTagNameMap[K], "style" | "children">> & { class?: string } = {},
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    const { class: cls, ...rest } = props as Record<string, unknown>;
    if (cls) node.className = cls as string;
    Object.assign(node, rest);
    for (const c of children) if (c) node.append(c);
    return node;
}

export function presenceLines(p: PresencePayload | null): string {
    if (!p) return "(nothing)";
    const kind = { 0: "Playing", 2: "Listening to", 3: "Watching" }[p.type];
    const lines = [`${kind} ${p.name}`];
    for (const [k, v] of [["details", p.details], ["state", p.state], ["image", p.largeImage], ["image text", p.largeText]] as const)
        if (v) lines.push(`${k}: ${v}`);
    for (const b of p.buttons ?? []) lines.push(`button: ${b.label} → ${b.url}`);
    if (p.startTimestamp) lines.push(`start: ${new Date(p.startTimestamp).toLocaleTimeString()}`);
    if (p.endTimestamp) lines.push(`end: ${new Date(p.endTimestamp).toLocaleTimeString()}`);
    return lines.join("\n");
}
