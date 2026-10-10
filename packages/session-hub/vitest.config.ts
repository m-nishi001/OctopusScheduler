import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["reflect-metadata"],
    // フェイクタイマーで長時間(1時間)を進めるテストがあるため余裕を持たせる
    testTimeout: 30_000,
  },
});
