import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    // `npm run test:coverage` で測る範囲と下限。抽選のモデルとアプリケーション層。
    // 下限は現在の実測を少し下回る値で、後退を防ぐためのもの(上げる方向にだけ見直す)。
    coverage: {
      provider: "v8",
      include: ["src/client/model/**", "src/client/control/**"],
      exclude: ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts", "**/testing/**", "**/endpoints.ts", "**/*-contract.ts", "**/container/**"],
      thresholds: { statements: 68, branches: 62, functions: 65, lines: 68 },
    },
    environment: "jsdom",
    include: ["src/client/**/*.spec.ts", "src/client/**/*.test.ts"],
    setupFiles: ["src/client/setup-tests.ts"],
    testTimeout: 60000,
    pool: "vmThreads",
  },
  resolve: {
    alias: {
      "@model": resolve(__dirname, "src/client/model"),
      "@control": resolve(__dirname, "src/client/control"),
      "@ui": resolve(__dirname, "src/client/ui"),
      "@octopus/composables": resolve(
        __dirname,
        "../composables/src"
      ),
      "@octopus/client-common": resolve(__dirname, "../client-common/src"),
      "packages/common-lib": resolve(
        __dirname,
        "../client-common/src"
      ),
    },
  },
});
