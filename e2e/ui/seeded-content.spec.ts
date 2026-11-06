import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, newDevice, test } from "./fixtures";

/**
 * シード済みの環境(`npm run dev:stack` / `npm run staging:up` が投入するクイズ・景品・画面設定)に向けて実行する。
 * 管理者でアプリを開くだけで、クイズ一覧・景品・画像・音・オープニング/エンディングが空でなく見えることを確認する。
 * シード無しの環境(`npm run e2e` の既定)ではスキップされる。
 *
 *   E2E_SEEDED=1 BASE=http://127.0.0.1:<port> E2E_ADMIN_TOKEN=<管理者トークン> npx playwright test -c e2e/playwright.config.ts seeded-content
 *   画面を目で確かめたいときは E2E_SHOTS=<出力先> を足す。
 */
test.skip(!process.env.E2E_SEEDED, "シード済みの環境でのみ実行する(E2E_SEEDED=1)");

const SHOTS = process.env.E2E_SHOTS;

test.describe("シード済みコンテンツ", () => {
  test("クイズ管理を開くと、シードのクイズが同期されて並ぶ", async ({ browser }) => {
    test.setTimeout(120_000);
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await page.goto("/#/quiz-admin/quizzes");
    for (const title of ["オクトパス豆知識", "暦のクイズ", "果物クイズ", "宇宙のクイズ", "富士山クイズ"]) {
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 60_000 });
    }
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: join(SHOTS, "quiz-admin.png") });
    }
    await dev.context.close();
  });

  test("ジャックポット管理を開くと、景品・素材・画面設定が同期される", async ({ browser }) => {
    test.setTimeout(180_000);
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/#/execute/jackpot-admin/prizes");
    for (const name of ["1等 ペア旅行券", "参加賞 オリジナルタンブラー"]) {
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 90_000 });
    }
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "jackpot-prizes.png") });

    // 素材(画像・音)が取り込まれ、画面設定が名前で参照している
    await page.goto("/#/execute/jackpot-admin/screens/opening");
    await expect(page.getByTestId("media-name").first()).toHaveText("opening.wav", { timeout: 90_000 });
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "jackpot-screen-opening.png") });

    // オープニング / エンディングが空でなく表示される
    await page.goto("/#/execute/jackpot-opening");
    await expect(page.getByText("オクトパス商事 年末ジャックポット抽選会")).toBeVisible({ timeout: 30_000 });
    if (SHOTS) {
      await page.waitForTimeout(2000); // フェードインを待ってから撮る
      await page.screenshot({ path: join(SHOTS, "jackpot-opening.png") });
    }
    await page.goto("/#/execute/jackpot-ending");
    await expect(page.getByText("ご参加ありがとうございました")).toBeVisible({ timeout: 30_000 });
    if (SHOTS) {
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(SHOTS, "jackpot-ending.png") });
    }
    await dev.context.close();
  });
});
