import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run test:coverage` で測る範囲と下限。サーバー・クライアントのモデル(転送を含む)・共有の型と関数。
    // 下限は現在の実測を少し下回る値で、後退を防ぐためのもの(上げる方向にだけ見直す)。
    coverage: {
      provider: "v8",
      include: ["src/server/**", "src/client/model/**", "src/shared/**"],
      exclude: ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts", "**/testing/**", "**/endpoints.ts", "**/*-contract.ts", "**/container/**"],
      thresholds: { statements: 85, branches: 80, functions: 85, lines: 88 },
    },
    environment: "node",
    setupFiles: ["reflect-metadata"],
    // フェイクタイマーで長時間(1時間)を進めるテストがあるため余裕を持たせる
    testTimeout: 30_000,
  },
});
