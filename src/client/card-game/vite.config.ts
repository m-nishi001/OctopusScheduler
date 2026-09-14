import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";
import { sharedAliasArray, sharedPlugins } from "../../../vite.shared";

// Combined/configured Vite file for card-game. Uses shared monorepo aliases/plugins.
export default defineConfig({
  plugins: [...sharedPlugins, viteSingleFile()],
  resolve: {
    alias: [
      ...sharedAliasArray(),
      // optional helper alias if some imports target a nested module
      {
        find: "@common/gas",
        replacement: path.resolve(
          __dirname,
          "../../packages/common-lib/src/google-apps-script/gas-script-service"
        ),
      },
    ],
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
