import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { sharedAliasArray } from "../../vite.shared";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/client/setup-tests.ts"],
    testTimeout: 60000,
    pool: "vmThreads",
  },
  resolve: {
    alias: [
      ...sharedAliasArray(),
      { find: "model", replacement: resolve(__dirname, "src/client") },
      { find: "ui", replacement: resolve(__dirname, "src/client/ui") },
      { find: "core", replacement: resolve(__dirname, "src/client/core") },
    ],
  },
});
