import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run test:coverage` で測る範囲と下限。ポートと組み合わせ(GAS / Cloudflare のアダプタは実機・e2e で確かめる)。
    // 下限は現在の実測を少し下回る値で、後退を防ぐためのもの(上げる方向にだけ見直す)。
    coverage: {
      provider: "v8",
      include: ["src/compositions/**", "src/interfaces/**"],
      exclude: ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts", "**/testing/**", "**/endpoints.ts", "**/*-contract.ts", "**/container/**"],
      thresholds: { statements: 80, branches: 70, functions: 90, lines: 80 },
    },
    environment: "node",
    // gas/cloudflare配下のtsyringe @injectable() クラスをテストで直接
    // importする場合に必要なreflectポリフィル。
    setupFiles: ["reflect-metadata"],
  },
});
