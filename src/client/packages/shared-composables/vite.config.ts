import { defineConfig } from "vite";
import path from "path";
import { sharedAliasArray, sharedPlugins } from "../../../vite.shared";

// https://vite.dev/config/
export default defineConfig({
  plugins: [...sharedPlugins],
  build: {
    target: "es2020",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "SharedComposables",
      fileName: (format) => `shared-composables.${format}.js`,
    },
    rollupOptions: {
      // 外部依存として vue と common-lib / packages/common-lib を除外
      external: [
        "vue",
        "@common-lib",
        /^@common-lib\//,
        "packages/common-lib",
        /^packages\/common-lib\//,
      ],
      output: {
        globals: {
          vue: "Vue",
          "@common-lib": "common-lib",
        },
      },
    },
  },
  resolve: {
    alias: [
      ...sharedAliasArray(),
      {
        find: "@shared-composables",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
});
