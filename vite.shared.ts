import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import type { Alias } from "vite";

// Shared resolve.alias mappings for the monorepo.
export const sharedAliases: Record<string, string> = {
  "@common-lib": path.resolve(__dirname, "src/client/packages/common-lib/src"),
  "@shared-composables": path.resolve(
    __dirname,
    "src/client/packages/shared-composables/src"
  ),
  "@presenters/content-deck": path.resolve(
    __dirname,
    "src/client/presenters/content-deck/src"
  ),
  "presenters/content-deck": path.resolve(
    __dirname,
    "src/client/presenters/content-deck/src"
  ),
  presenters: path.resolve(__dirname, "src/client/presenters"),
  "packages/common-lib": path.resolve(
    __dirname,
    "src/client/packages/common-lib/src"
  ),
  "games/jackpot-game": path.resolve(
    __dirname,
    "src/client/games/jackpot-game/src"
  ),
  "games/card-game": path.resolve(__dirname, "src/client/games/card-game/src"),
  "games/quiz-game": path.resolve(__dirname, "src/client/games/quiz-game/src"),
};

// Expose as Alias[] for Vite config
export function sharedAliasArray(): Alias[] {
  return Object.entries(sharedAliases).map(([find, replacement]) => ({
    find,
    replacement,
  }));
}

// Shared plugins we want in all client builds (ensure tsconfigPaths is first)
export const sharedPlugins = [tsconfigPaths(), vue()];

export default {
  sharedAliases,
  sharedAliasArray,
  sharedPlugins,
};
