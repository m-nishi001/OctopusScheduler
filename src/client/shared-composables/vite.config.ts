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
      // 注意: '@common-lib/*' のサブパスを external として扱っているため、
      //       Rollup の globals に個別サブパスのマッピングを追加しておく。
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
          // 共通ライブラリを UMD グローバルとして expose する場合の名前。
          // JavaScript の識別子として有効な名前にしておく（ハイフンは避ける）。
          "@common-lib": "commonLib",
          // サブパスを個別にマッピングしておくと、"No name was provided for external module ..."
          // の警告を抑制できる（全て同じ global オブジェクトを参照する想定）。
          "@common-lib/audio/audio-service": "commonLib",
          "@common-lib/storage/local-storage-service": "commonLib",
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
