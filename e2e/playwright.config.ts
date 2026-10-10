import { defineConfig } from "@playwright/test";

/**
 * 画面の通しテスト(ホスト/管理/参加者の複数端末)。
 * scripts/e2e-local.js が wrangler dev --local を起動し、BASE にそのURLを渡して実行する。
 * 各テストは複数の BrowserContext(=別端末)を使うため、並列実行はせず1つずつ流す。
 */
export default defineConfig({
  testDir: "./ui",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: process.env.E2E_OUTPUT_DIR ?? "../node_modules/.cache/e2e-results",
});
