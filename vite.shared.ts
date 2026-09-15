import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import type { Alias } from "vite";

// Shared resolve.alias mappings for the monorepo.
export const sharedAliases: Record<string, string> = {
  "@octopus/core": path.resolve(__dirname, "src/core/src"),
  "@common-lib": path.resolve(__dirname, "src/client/common-lib/src"),
  "@shared-composables": path.resolve(
    __dirname,
    "src/client/shared-composables/src"
  ),
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
