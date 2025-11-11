import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { sharedAliasArray, sharedPlugins } from "../../../vite.shared";
import { resolve } from "path";

export default defineConfig({
  plugins: [...sharedPlugins, viteSingleFile()],
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
    alias: [
      ...sharedAliasArray(),
      { find: "@server", replacement: resolve(__dirname, "../server") },
      { find: "@model", replacement: resolve(__dirname, "src/model") },
      {
        find: "@shared-composables",
        replacement: resolve(
          __dirname,
          "../../packages/shared-composables/src"
        ),
      },
      // allow imports like "pages/home/home.vue" to resolve to src/ui/pages
      { find: "pages", replacement: resolve(__dirname, "src/ui/pages") },
      {
        find: "components",
        replacement: resolve(__dirname, "src/ui/components"),
      },
    ],
  },
});
