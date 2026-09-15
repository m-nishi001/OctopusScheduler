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
  resolve: {
    alias: [
      ...sharedAliasArray(),
      { find: "model", replacement: resolve(__dirname, "src/model") },
      { find: "ui", replacement: resolve(__dirname, "src/ui") },
      { find: "core", replacement: resolve(__dirname, "src/core") },
      {
        find: "@model",
        replacement: resolve(__dirname, "../jackpot-game/src/model"),
      },
      {
        find: "@shared-composables",
        replacement: resolve(__dirname, "../shared-composables/src"),
      },
      {
        find: "@composables",
        replacement: resolve(
          __dirname,
          "../jackpot-game/src/composables"
        ),
      },
      {
        find: "components",
        replacement: resolve(
          __dirname,
          "../jackpot-game/src/ui/components"
        ),
      },
      {
        find: "pages",
        replacement: resolve(__dirname, "../jackpot-game/src/ui/pages"),
      },
      {
        find: "presenters/content-deck",
        replacement: resolve(__dirname, "../content-deck/src"),
      },
      {
        find: "games/jackpot-game",
        replacement: resolve(__dirname, "../jackpot-game/src"),
      },
      {
        find: "games/card-game",
        replacement: resolve(__dirname, "../card-game/src"),
      },
      {
        find: "games/quiz-game",
        replacement: resolve(__dirname, "../quiz-game/src"),
      },
    ],
  },
});
