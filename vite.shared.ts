import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import type { Alias } from "vite";

const sharedAliases: Record<string, string> = {};

// Expose as Alias[] for Vite config
/** 各パッケージの Vite / Vitest の設定で共通に使う、別名(alias)の一覧。 */
export function sharedAliasArray(): Alias[] {
  return Object.entries(sharedAliases).map(([find, replacement]) => ({
    find,
    replacement,
  }));
}

// Shared plugins we want in all client builds.
// Crawl both solution tsconfig files and per-package tsconfig.app.json files so
// package-local path aliases resolve without copying them into the host config.
export const sharedPlugins = [
  tsconfigPaths({
    root: __dirname,
    configNames: [
      "tsconfig.json",
      "tsconfig.app.json",
      "tsconfig.node.json",
      "jsconfig.json",
    ],
    loose: true,
  }),
  vue(),
];

export default {
  sharedAliases,
  sharedAliasArray,
  sharedPlugins,
};
