import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/setup-tests.ts"],
  },
  resolve: {
    alias: {
      "@server": resolve(__dirname, "../server"),
      "@model": resolve(__dirname, "src/model"),
      "@shared-composables": resolve(
        __dirname,
        "../../packages/shared-composables/src"
      ),
      pages: resolve(__dirname, "src/ui/pages"),
      components: resolve(__dirname, "src/ui/components"),
      "packages/common-lib": resolve(
        __dirname,
        "../../packages/common-lib/src"
      ),
    },
  },
});
