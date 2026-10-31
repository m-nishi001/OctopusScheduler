import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { sharedAliasArray } from "../../vite.shared";

export default defineConfig({
  plugins: [vue()],
  test: {
    // `npm run test:coverage` で測る範囲と下限。予定イベント・素材のモデルと制御、サーバー。
    // 下限は現在の実測を少し下回る値で、後退を防ぐためのもの(上げる方向にだけ見直す)。
    coverage: {
      provider: "v8",
      include: ["src/client/model/**", "src/client/control/**", "src/server/**"],
      exclude: ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts", "**/testing/**", "**/endpoints.ts", "**/*-contract.ts", "**/container/**"],
      thresholds: { statements: 55, branches: 58, functions: 55, lines: 53 },
    },
    environment: "jsdom",
    setupFiles: ["src/client/setup-tests.ts"],
    testTimeout: 60000,
    pool: "vmThreads",
  },
  resolve: {
    alias: [
      ...sharedAliasArray(),
      { find: "@model", replacement: resolve(__dirname, "src/client/model") },
      {
        find: "@control",
        replacement: resolve(__dirname, "src/client/control"),
      },
      { find: "@ui", replacement: resolve(__dirname, "src/client/ui") },
    ],
  },
});
