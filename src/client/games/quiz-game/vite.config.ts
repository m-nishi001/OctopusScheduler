import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [tsconfigPaths(), vue(), viteSingleFile()],
  build: {
    target: "es2020",
    outDir: "dist",
  },
  server: {
    host: true,
    port: 5174,
    strictPort: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5174,
    },
  },
  resolve: {
    alias: {
      "@common-lib": resolve(__dirname, "../../packages/common-lib/src"),
      "@shared-composables": resolve(
        __dirname,
        "../../packages/shared-composables/src"
      ),
      "@server": resolve(__dirname, "../../../../server"),
      "@model": resolve(__dirname, "src/model"),
      // allow imports like "pages/home/home.vue" to resolve to src/ui/pages
      pages: resolve(__dirname, "src/ui/pages"),
      components: resolve(__dirname, "src/ui/components"),
    },
  },
});
