import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
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
