/// <reference types="vite/client" />
// Every other module in this folder default-exports one preset Rule (added in S007).
import type { Rule } from "../rules/types.ts";

const modules = import.meta.glob<{ default: Rule }>(["./*.ts", "!./index.ts"], { eager: true });

export const presets: Rule[] = Object.values(modules).map(m => m.default);
