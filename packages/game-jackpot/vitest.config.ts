import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/setup-tests.ts"],
    testTimeout: 60000,
    pool: "vmThreads",
  },
  resolve: {
    alias: {
      "@model": resolve(__dirname, "src/model"),
      "@octopus/composables": resolve(
        __dirname,
        "../composables/src"
      ),
      "@octopus/client-common": resolve(__dirname, "../client-common/src"),
      pages: resolve(__dirname, "src/ui/pages"),
      components: resolve(__dirname, "src/ui/components"),
      "packages/common-lib": resolve(
        __dirname,
        "../client-common/src"
      ),
      "@composables": resolve(__dirname, "src/composables"),
      "@components": resolve(__dirname, "src/components"),
    },
  },
});
