import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // dirty-tracker.ts が client-common の LocalStorageService(localforage)を
    // 使うため、localStorage driverが動くjsdom環境で実行する。
    environment: "jsdom",
    setupFiles: ["reflect-metadata"],
  },
});
