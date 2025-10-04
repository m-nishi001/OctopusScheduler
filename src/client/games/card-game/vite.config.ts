import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  resolve: {
    alias: {
      "@common/gas": path.resolve(
        __dirname,
        "../../packages/common-lib/src/google-apps-script/gas-script-service.js"
      ),
    },
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
