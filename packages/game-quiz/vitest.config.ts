import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    include: ["src/client/**/*.spec.ts"],
    setupFiles: ["reflect-metadata"],
    watch: false,
  },
  resolve: {
    alias: {
      "@model": resolve(__dirname, "src/client/model"),
      "@control": resolve(__dirname, "src/client/control"),
      "@ui": resolve(__dirname, "src/client/ui"),
      "@octopus/composables": resolve(__dirname, "../composables/src"),
      "@octopus/client-common": resolve(__dirname, "../client-common/src"),
    },
  },
});
