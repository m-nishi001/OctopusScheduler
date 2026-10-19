import { defineConfig } from "@playwright/test";

/**
 * 負荷テスト(画面つき)。実ブラウザのホスト・管理・参加者に、合成の参加者を足して、
 * 参加者50人・管理2人の負荷がかかった状態で画面が正しく動くことを確かめる。
 * scripts/e2e-local.js(npm run e2e -- load-ui)が wrangler dev --local を起動し、BASE を渡して実行する。
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 20 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: process.env.E2E_OUTPUT_DIR ?? "../../node_modules/.cache/e2e-load-results",
});
