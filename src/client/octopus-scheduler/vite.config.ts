import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  build: {
    target: "es2020",
    outDir: "dist",
  },
  resolve: {
    alias: {
      model: resolve(__dirname, "src/model"),
      ui: resolve(__dirname, "src/ui"),
      core: resolve(__dirname, "src/core"),
      "@model": resolve(__dirname, "../games/jackpot-game/src/model"),
      "@shared-composables": resolve(
        __dirname,
        "../packages/shared-composables/src"
      ),
      components: resolve(__dirname, "../games/jackpot-game/src/ui/components"),
      pages: resolve(__dirname, "../games/jackpot-game/src/ui/pages"),
      "packages/common-lib": resolve(__dirname, "../packages/common-lib/src"),
    },
  },
});
