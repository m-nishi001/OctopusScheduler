import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { sharedAliasArray, sharedPlugins } from "../../vite.shared";
import { resolve } from "path";

export default defineConfig({
  plugins: [...sharedPlugins, viteSingleFile()],
  build: {
    target: "es2020",
    outDir: "dist",
  },
  resolve: {
    alias: [
      ...sharedAliasArray(),
      { find: "model", replacement: resolve(__dirname, "src/model") },
      { find: "ui", replacement: resolve(__dirname, "src/ui") },
      { find: "core", replacement: resolve(__dirname, "src/core") },
    ],
  },
});
