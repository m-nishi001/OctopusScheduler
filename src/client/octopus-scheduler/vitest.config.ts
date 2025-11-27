import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { sharedAliasArray } from "../../../vite.shared";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/setup-tests.ts"],
  },
  resolve: {
    alias: [
      ...sharedAliasArray(),
      { find: "model", replacement: resolve(__dirname, "src/model") },
      { find: "ui", replacement: resolve(__dirname, "src/ui") },
      { find: "core", replacement: resolve(__dirname, "src/core") },
      {
        find: "@composables",
        replacement: resolve(
          __dirname,
          "../games/jackpot-game/src/composables"
        ),
      },
    ],
  },
});
