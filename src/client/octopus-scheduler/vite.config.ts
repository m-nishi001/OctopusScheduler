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
    },
  },
});
