import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vitest/config";
import manifest from "./manifest.config.ts";

export default defineConfig({
    plugins: [crx({ manifest })],
    server: { fs: { allow: [".."] } },
    test: {
        environment: "happy-dom",
        include: ["tests/**/*.test.ts", "../plugin/tests/**/*.test.ts"]
    }
});
