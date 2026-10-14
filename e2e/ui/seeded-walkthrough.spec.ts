import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { adminRpc, expect, newDevice, nextButton, openAdvanced, route, test } from "./fixtures";
import { expectNoHorizontalOverflow } from "./helpers/responsive";

/**
 * 第三者の目線の通しチェック(シード済みの環境向け)。
 * `npm run staging:up` / `npm run dev:stack` が用意した架空データだけを前提に、
 *   1. 参加者(スマホ)がログインして、ホーム・結果(サンプルの順位/当選履歴)を一通り見られる
 *   2. 管理者が、クイズ・ジャックポットの各管理画面・演出画面を開ける(空でなく、エラーも出ない)
 *   3. 管理端末の操作だけでクイズを出題 → 参加者が回答 → 結果発表 → 参加者の「結果」に反映される
 * ことを確認する。シード無しの環境(`npm run e2e` の既定)ではスキップされる。
 *
 *   E2E_SEEDED=1 BASE=<URL> E2E_ADMIN_TOKEN=<管理者トークン> npx playwright test -c e2e/playwright.config.ts seeded-walkthrough
 *   画面を目で確かめたいときは E2E_SHOTS=<出力先> を足す。
 */
test.skip(!process.env.E2E_SEEDED, "シード済みの環境でのみ実行する(E2E_SEEDED=1)");

const SHOTS = process.env.E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};


/** 受付QR相当でログインした参加者のスマホ。シードの参加者は、管理者がログインキーを発行して入る。 */
async function loginAs(browser: import("@playwright/test").Browser, request: APIRequestContext, id: string) {
  const { key } = await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id });
  const d = await newDevice(browser, { mobile: true });
  await d.page.goto(`/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`);
  await expect(d.page.getByTestId("home-greeting")).toBeVisible();
  await expect(d.page.getByTestId("portal-conn")).toContainText("接続中", { timeout: 30_000 });
  return d;
}

/** ポータルに公開中のセッション(シードが作ったもの)。 */
async function portalSession(request: APIRequestContext): Promise<{ id: string; name: string }> {
  const list = await adminRpc<Array<{ id: string; name: string; portal?: boolean; status: string }>>(request, "sessionHub_listSessions", undefined);
  const found = list.find((s) => s.portal && s.status !== "closed");
  if (!found) throw new Error("ポータル公開中のセッションがありません(npm run staging:seed を実行してください)");
  return found;
}

test.describe("第三者の通しチェック(シード済みの環境)", () => {
  test("参加者: ログインしてホームと結果(順位・当選履歴)を見られる。結果は空でなく、自分の当選が目立つ", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const winner = await loginAs(browser, request, "test-user-03"); // サンプルの当選者の1人
    const other = await loginAs(browser, request, "test-user-02"); // 当選していない人

    // ホーム: あいさつ・会場の人数・タブ
    await expect(winner.page.getByTestId("home-greeting")).toContainText("テスト参加者03");
    // 進行中のクイズなどが無ければ「イベントの案内」、あればそのカードが出る(どちらでも空ではない)
    await expect(winner.page.getByTestId("home-status").or(winner.page.getByTestId("quiz-panel"))).toBeVisible();
    await expect(winner.page.locator(".pp-tabs__item")).toHaveCount(3);
    await expectNoHorizontalOverflow(winner.page, "ホーム");
    await shot(winner.page, "portal-home");

    // 結果: クイズ(総合ランキング + 各問)
    await winner.page.getByRole("link", { name: "結果" }).click();
    await expect(winner.page.getByTestId("results-round").first()).toBeVisible({ timeout: 20_000 });
    expect(await winner.page.getByTestId("results-round").count(), "各問の結果が3問以上ある").toBeGreaterThanOrEqual(3);
    expect(await winner.page.locator('[data-testid="results-cumulative"] li').count(), "総合ランキングが5人以上いる").toBeGreaterThanOrEqual(5);
    await expect(winner.page.getByTestId("results-my-wins")).toContainText("1"); // 当選1回
    await expectNoHorizontalOverflow(winner.page, "結果(クイズ)");
    await shot(winner.page, "portal-results-quiz");

    // 結果: ジャックポット
    await winner.page.getByTestId("results-tab-jackpot").click();
    expect(await winner.page.getByTestId("results-draw").count(), "当選履歴が5件ある").toBeGreaterThanOrEqual(5);
    await expect(winner.page.getByTestId("results-draw-mine")).toHaveText("あなたが当選!");
    await expectNoHorizontalOverflow(winner.page, "結果(ジャックポット)");
    await shot(winner.page, "portal-results-jackpot");

    // 当選していない人には強調が出ない。他の人のIDは画面に出ない
    await other.page.getByRole("link", { name: "結果" }).click();
    await other.page.getByTestId("results-tab-jackpot").click();
    await expect(other.page.getByTestId("results-draw").first()).toBeVisible({ timeout: 20_000 });
    await expect(other.page.getByTestId("results-draw-mine")).toHaveCount(0);
    expect(await other.page.content()).not.toContain("test-user-03");

    // マイページ
    await winner.page.getByRole("link", { name: "マイページ" }).click();
    await expect(winner.page.getByText("test-user-03").first()).toBeVisible();
    await shot(winner.page, "portal-me");

    await winner.context.close();
    await other.context.close();
  });

  test("管理者: クイズ・ジャックポットの全画面を開ける(空でなく、エラー・404・横スクロールが無い)", async ({ browser }) => {
    test.setTimeout(300_000);
    const dev = await newDevice(browser, { signedIn: true, projector: true });
    const page = dev.page;
    const problems: string[] = [];
    let current = "";
    page.on("pageerror", (e) => problems.push(`[${current}] pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`[${current}] console.error: ${m.text().slice(0, 200)}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400 && !r.url().includes("favicon")) problems.push(`[${current}] HTTP ${r.status()} ${r.url()}`);
    });

    // 管理画面を開くと、クイズ・景品・画面設定・画像/音がサーバーから取り込まれる(初回)
    current = "/quiz-admin/quizzes";
    await page.goto("/#/quiz-admin/quizzes");
    await expect(page.getByText("オクトパス豆知識").first()).toBeVisible({ timeout: 60_000 });
    current = "/execute/jackpot-admin/prizes";
    await page.goto("/#/execute/jackpot-admin/prizes");
    // 再読み込み無しで、取り込みの完了と同時に一覧へ出る(初めて開いた人が「空」と誤解しない)
    await expect(page.getByText("1等 ペア旅行券").first()).toBeVisible({ timeout: 90_000 });

    const SCREENS: Array<[string, string]> = [
      ["/home", "Octopus Scheduler"],
      ["/sessions", "年末ジャックポット"],
      ["/quiz-admin/quizzes", "オクトパス豆知識"],
      ["/execute/jackpot-admin/members", "テスト参加者"],
      ["/execute/jackpot-admin/prizes", "1等 ペア旅行券"],
      ["/execute/jackpot-admin/assets", "seed-prize-1.png"],
      ["/execute/jackpot-admin/results", ""],
      ["/execute/jackpot-admin/screens/opening", ""],
      ["/execute/jackpot-admin/screens/description", ""],
      ["/execute/jackpot-admin/screens/demo", ""],
      ["/execute/jackpot-admin/screens/draw", ""],
      ["/execute/jackpot-admin/screens/result", ""],
      ["/execute/jackpot-admin/screens/ending", ""],
      ["/execute/jackpot-opening", "年末ジャックポット"],
      ["/execute/jackpot-description", ""],
      ["/execute/jackpot-ending", "ご参加ありがとうございました"],
    ];
    for (const [path, expected] of SCREENS) {
      current = path;
      await page.goto(`/#${path}`);
      if (expected) await expect(page.getByText(expected).first(), `${path} に「${expected}」が出る`).toBeVisible({ timeout: 30_000 });
      else await page.waitForTimeout(2500);
      const bodyText = (await page.locator("body").innerText()).trim();
      expect(bodyText.length, `${path} が空でない`).toBeGreaterThan(5);
      await expectNoHorizontalOverflow(page, path);
      await shot(page, `admin-${path.replace(/^\//, "").replace(/\//g, "_")}`);
    }
    expect([...new Set(problems)], [...new Set(problems)].join("\n")).toEqual([]);
    await dev.context.close();
  });

  test("通し: 管理端末の操作でクイズを出題 → 参加者が回答 → 結果発表 → 参加者の「結果」に反映される", async ({ browser, request }) => {
    test.setTimeout(240_000);
    const session = await portalSession(request);
    const admin = await newDevice(browser, { signedIn: true });
    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());

    // それぞれの端末で、クイズをサーバーから取り込んでおく(初回の同期)
    for (const d of [admin, host]) {
      await d.page.goto("/#/quiz-admin/quizzes");
      await expect(d.page.getByText("オクトパス豆知識").first()).toBeVisible({ timeout: 60_000 });
    }
    await host.page.goto(`/#/session/host/${session.id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();
    await admin.page.goto(`/#/session/console/${session.id}`);

    const taro = await loginAs(browser, request, "test-user-05");
    const hanako = await loginAs(browser, request, "test-user-06");

    await admin.page.getByTestId("quiz-select").selectOption("seed-quiz-1");
    await openAdvanced(admin.page);
    await admin.page.getByTestId("advanced").getByRole("button", { name: "イントロ" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/seed-quiz-1/intro");
    await shot(host.page, "quiz-host-intro");
    await nextButton(admin.page).click(); // エントリー
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/seed-quiz-1/entry");
    await nextButton(admin.page).click(); // 出題
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/seed-quiz-1/play");
    await shot(host.page, "quiz-host-play");

    // 参加者のスマホに問題が出る → 5番さんは正解(3つ)、6番さんは不正解(1つ)
    await expect(taro.page.getByTestId("quiz-panel")).toContainText("タコの心臓はいくつある?");
    await shot(taro.page, "quiz-portal-play");
    await taro.page.getByRole("button", { name: /3つ/ }).click();
    await expect(taro.page.getByTestId("quiz-answered")).toContainText("3つ");
    await hanako.page.getByRole("button", { name: /1つ/ }).click();
    await expect(hanako.page.getByTestId("quiz-answered")).toContainText("1つ");
    await expect(admin.page.getByTestId("quiz-state")).toContainText("回答 2 人");

    await nextButton(admin.page).click(); // 回答受付中は主ボタンが「受付を締め切る」
    await nextButton(admin.page).click(); // 正解発表
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/seed-quiz-1/answer");
    await expect(taro.page.getByTestId("quiz-verdict")).toHaveText("正解！");
    await expect(hanako.page.getByTestId("quiz-verdict")).toContainText("残念");
    await shot(taro.page, "quiz-portal-answer");
    await nextButton(admin.page).click(); // 結果発表
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/seed-quiz-1/result");
    await expect(host.page.getByText("テスト参加者05").first()).toBeVisible({ timeout: 30_000 });
    await shot(host.page, "quiz-host-result");

    // 順位発表が終わると、参加者の「結果」に今の出題が加わる(サンプルの回とは別に)
    await taro.page.getByRole("link", { name: "結果" }).click();
    const mine = taro.page.getByTestId("results-round").filter({ hasText: /^オクトパス豆知識/ });
    await expect(mine).toHaveCount(1, { timeout: 90_000 });
    await expect(mine.getByTestId("results-round-verdict")).toHaveText("正解 1位");
    await shot(taro.page, "portal-results-after-quiz");
    await hanako.page.getByRole("link", { name: "結果" }).click();
    await expect(hanako.page.getByTestId("results-round").filter({ hasText: /^オクトパス豆知識/ }).getByTestId("results-round-verdict")).toHaveText("不正解", { timeout: 60_000 });

    for (const d of [admin, host, taro, hanako]) await d.context.close();
  });
});
