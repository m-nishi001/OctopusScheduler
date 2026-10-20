import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run test:coverage` で測る範囲と下限。サーバーの認証・名簿のロジック。
    // 下限は現在の実測を少し下回る値で、後退を防ぐためのもの(上げる方向にだけ見直す)。
    coverage: {
      provider: "v8",
      include: ["src/server/**"],
      exclude: ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts", "**/testing/**", "**/endpoints.ts", "**/*-contract.ts", "**/container/**"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
