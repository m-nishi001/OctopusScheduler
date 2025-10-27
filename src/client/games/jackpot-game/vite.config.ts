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
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
    },
  },
  resolve: {
    alias: {
      "@server": resolve(__dirname, "../server"),
      "@model": resolve(__dirname, "src/model"),
      // allow imports like "pages/home/home.vue" to resolve to src/ui/pages
      pages: resolve(__dirname, "src/ui/pages"),
      components: resolve(__dirname, "src/ui/components"),
      "packages/common-lib": resolve(
        __dirname,
        "../../packages/common-lib/src"
      ),
    },
  },
});
