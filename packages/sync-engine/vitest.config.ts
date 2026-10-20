import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run test:coverage` で測る範囲と下限。全体。
    // 下限は現在の実測を少し下回る値で、後退を防ぐためのもの(上げる方向にだけ見直す)。
    // 分岐は22個しかなく、全パッケージを並列で流すと 95% → 77% に下がることがあった(単独では安定)ので、揺らぎより低くしてある。
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts", "**/testing/**", "**/endpoints.ts", "**/*-contract.ts", "**/container/**"],
      thresholds: { statements: 90, branches: 70, functions: 90, lines: 90 },
    },
    // dirty-tracker.ts が client-common の LocalStorageService(localforage)を
    // 使うため、localStorage driverが動くjsdom環境で実行する。
    environment: "jsdom",
    setupFiles: ["reflect-metadata"],
  },
});
