import type { APIRequestContext, Page } from "@playwright/test";
import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, route, sampleQuiz, seedStore, test } from "./fixtures";

/**
 * クイズを、ホスト(投影)・管理・参加者(ログイン済みのスマホ)で通しで動かす。
 * 出題 → 参加者の回答(サーバ時刻の締切) → 締切 → 正解発表 → 結果、までを実ブラウザで確認する。
 * 参加者は受付QRでログインした別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは各テストの中で作り、終わったら消す。
 */

const NAMES = ["太郎", "花子", "次郎"];
const ids = NAMES.map((_, i) => `qz-e2e-${String(i + 1).padStart(2, "0")}`);
const keys = new Map<string, string>();
const sessionIds: string[] = [];

const qrUrl = (id: string) => `/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(keys.get(id)!)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  for (const [i, id] of ids.entries()) {
    await adminRpc(request, "accounts_addMember", { id, name: NAMES[i] });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

const publish = (request: APIRequestContext, sessionId: string, published = true) =>
  adminRpc(request, "sessionHub_setPortalSession", { sessionId, published });

const seedQuiz = (page: Page, id: string, timeLimit = 60) =>
  seedStore(page, "quiz-game", "QuizData", [{ id, value: sampleQuiz(id, timeLimit) }]);

async function scene(browser: import("@playwright/test").Browser, request: APIRequestContext, label: string, quizId: string, timeLimit: number) {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  await seedQuiz(admin.page, quizId, timeLimit); // 管理端末の一覧に出すため
  await admin.page.reload();
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  await seedQuiz(host.page, quizId, timeLimit);
  await publish(request, sessionId);
  return { admin, host, sessionId };
}

async function login(browser: import("@playwright/test").Browser, id: string) {
  const d = await newDevice(browser, { mobile: true });
  await d.page.goto(qrUrl(id));
  await expect(d.page.getByTestId("home-greeting")).toBeVisible();
  await expect(d.page.getByTestId("portal-conn")).toContainText("接続中");
  return d;
}

test.describe("クイズ（参加者ポータル）", () => {
  test("出題 → 参加者の回答 → 締切 → 正解発表 → 結果まで、管理端末の操作だけで進む", async ({ browser, request }) => {
    test.setTimeout(180_000);
    const { admin, host, sessionId } = await scene(browser, request, "クイズ会場", "qz1", 60);
    const taro = await login(browser, ids[0]);
    const hanako = await login(browser, ids[1]);
    const jiro = await login(browser, ids[2]); // 回答しない人

    // 管理端末: クイズを選んでイントロ → QR → 出題
    await admin.page.getByTestId("quiz-select").selectOption("qz1");
    await openAdvanced(admin.page);
    await admin.page.getByTestId("advanced").getByRole("button", { name: "イントロ" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/intro");
    await expect(taro.page.getByTestId("quiz-panel")).toContainText("クイズが始まります");

    await nextButton(admin.page).click(); // → QR
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/entry");
    await nextButton(admin.page).click(); // → 出題
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/play");
    await expect(admin.page.getByTestId("now")).toContainText("回答受付中");

    // 参加者のスマホに問題と選択肢・残り時間が出て、バナーは出題中でも、ホームでは重ねない
    await expect(taro.page.getByTestId("quiz-panel")).toContainText("みかんはどれ?");
    await expect(taro.page.getByTestId("quiz-timer")).toContainText("残り");
    // 別の画面（マイページ）にいる人には、バナーで出題を知らせる
    await jiro.page.getByRole("link", { name: "マイページ" }).click();
    await expect(jiro.page.getByTestId("event-banner")).toContainText("クイズ出題中!");
    await jiro.page.getByTestId("event-banner").click();
    await expect(jiro.page.getByTestId("quiz-panel")).toContainText("みかんはどれ?");

    await taro.page.getByRole("button", { name: /みかん/ }).click();
    await expect(taro.page.getByTestId("quiz-answered")).toContainText("2. みかん");
    await hanako.page.getByRole("button", { name: /りんご/ }).click();
    await expect(hanako.page.getByTestId("quiz-answered")).toContainText("1. りんご");
    // 回答後に選び直せない。答えた人にはバナーは出ない
    await expect(taro.page.getByRole("button", { name: /ぶどう/ })).toBeDisabled();
    // 管理端末に回答数(まとめて配信)
    await expect(admin.page.getByTestId("quiz-state")).toContainText("回答 2 人");

    // 同じ人が別のスマホで答えようとしても、先着の回答のまま（1人1回）
    const taro2 = await login(browser, ids[0]);
    await expect(taro2.page.getByTestId("quiz-panel")).toContainText("みかんはどれ?");
    await taro2.page.getByRole("button", { name: /ぶどう/ }).click();
    await expect(taro2.page.getByTestId("quiz-answered")).toContainText("2. みかん");
    await expect(admin.page.getByTestId("quiz-state")).toContainText("回答 2 人");

    // 参加者のリロードでも回答済み表示が残る
    await taro.page.reload();
    await expect(taro.page.getByTestId("quiz-answered")).toContainText("2. みかん");

    // 管理端末から受付を締め切る → 以後は回答できない
    await nextButton(admin.page).click(); // 回答受付中は主ボタンが「受付を締め切る」
    await expect(host.page.getByText("受付終了。Enterで正解表示")).toBeVisible();
    await expect(jiro.page.getByTestId("quiz-closed")).toBeVisible();

    // 正解発表: 参加者の画面に正解と正誤が出る
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/answer");
    await expect(taro.page.getByTestId("quiz-correct")).toContainText("2. みかん");
    await expect(taro.page.getByTestId("quiz-verdict")).toHaveText("正解！");
    await expect(hanako.page.getByTestId("quiz-verdict")).toContainText("残念");
    await expect(jiro.page.getByTestId("quiz-panel")).toContainText("あなたは回答していません");

    // 結果: ホストにランキング(正答者=太郎)が出る
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/result");
    // 順位発表は最下位(10位)から積み上がる: 行が増えるたびに順位の数字が重複せず、最後に1位(太郎)が最上段に出る
    const badges = () => host.page.locator(".ranking-item .rank-badge").allTextContents();
    expect((await badges()).length).toBeLessThanOrEqual(10);
    for (let i = 0; i < 30; i++) {
      const seen = await badges();
      expect(new Set(seen).size).toBe(seen.length);
      if (seen[0] === "1") break;
      await host.page.waitForTimeout(500);
    }
    await expect(host.page.locator(".ranking-item").first()).toContainText("太郎", { timeout: 30_000 });
    await expect(host.page.locator(".ranking-item .rank-badge").first()).toHaveText("1");
    await expect(host.page.locator(".ranking-item .rank-badge").last()).toHaveText("10");
    await expect(taro.page.getByTestId("quiz-panel")).toContainText("結果発表中");

    // 順位発表が終わると、結果がサーバー(R2)に保存される(参加者ポータルの「結果」の元データ)
    type Results = { rev: number; quiz: { rounds: Array<{ title: string; answeredCount: number; correctCount: number; top: Array<{ name: string }> }> } };
    await expect
      .poll(async () => (await adminRpc<Results>(request, "sessionHub_getResults", { sessionId })).quiz.rounds[0] ?? null, { timeout: 60_000 })
      .toMatchObject({ title: "果物クイズ", answeredCount: 2, correctCount: 1, top: [{ name: "太郎" }] });

    // 当選者がいるので「次へ」で景品(当選者名つき)が出て、もう一度「次へ」でロビーに戻る(管理画面には出ない)
    const next = nextButton(admin.page);
    await next.click();
    await expect(host.page.getByText("おめでとうございます")).toBeVisible();
    await expect(host.page.getByText("太郎 さん")).toBeVisible();
    await next.click();
    await expect.poll(() => route(host.page)).toBe(`/session/host/${sessionId}`);

    await publish(request, sessionId, false);
    for (const d of [admin, host, taro, taro2, hanako, jiro]) await d.context.close();
  });

  test("エントリー画面: 受付を手動で始めなくても自動で始まり、人数が増え、「次へ」で締め切って出題に進む", async ({ browser, request }) => {
    test.setTimeout(150_000);
    const { admin, host, sessionId } = await scene(browser, request, "エントリー会場", "qz6", 60);
    const taro = await login(browser, ids[0]);
    const hanako = await login(browser, ids[1]);

    // 「このクイズを始める」だけ(エントリー受付は手動で始めない)
    await admin.page.getByTestId("quiz-select").selectOption("qz6");
    await admin.page.getByTestId("start-quiz").click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz6/intro");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付は始まっていません");

    // イントロの次: ホストはQRではなくエントリー画面になり、受付が自動で始まる
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz6/entry");
    await expect(admin.page.getByTestId("now")).toContainText("エントリー受付中");
    await expect(host.page.getByTestId("stage-label")).toHaveText("エントリー受付中!");
    await expect(host.page.getByTestId("stage-count")).toHaveText("0");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付中");

    // 参加者がエントリーするたびに、会場の人数が増える
    for (const g of [taro, hanako]) {
      await g.page.getByTestId("event-banner").click();
      await g.page.getByTestId("entry-button").click();
      await expect(g.page.getByTestId("entry-done")).toContainText("エントリーしました!");
    }
    await expect(host.page.getByTestId("stage-count")).toHaveText("2");
    await expect(host.page.getByTestId("entry-bubble")).toHaveCount(2);
    await host.page.screenshot({ path: "/tmp/claude-0/quiz-host-entry.png" });

    // 「次へ」でエントリーを締め切って出題へ。エントリーした人の一覧は残る(ジャックポットの抽選の対象)
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz6/play");
    await expect(admin.page.getByTestId("now")).toContainText("回答受付中");
    await expect(admin.page.getByTestId("entry-state")).toContainText("エントリー受付は終了");
    await expect(admin.page.getByTestId("pool-state")).toContainText("2人");

    await publish(request, sessionId, false);
    for (const d of [admin, host, taro, hanako]) await d.context.close();
  });

  test("全員不正解なら景品は出さず、「次へ」でそのままロビーに戻る", async ({ browser, request }) => {
    test.setTimeout(150_000);
    const { admin, host, sessionId } = await scene(browser, request, "不正解会場", "qz4", 60);
    const hanako = await login(browser, ids[1]);

    await admin.page.getByTestId("quiz-select").selectOption("qz4");
    await openAdvanced(admin.page);
    await admin.page.getByTestId("advanced").getByRole("button", { name: "出題" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz4/play");
    await hanako.page.getByRole("button", { name: /りんご/ }).click(); // 正解は2番なので不正解
    await expect(hanako.page.getByTestId("quiz-answered")).toContainText("1. りんご");
    await nextButton(admin.page).click(); // 回答受付中は主ボタンが「受付を締め切る」

    const next = nextButton(admin.page);
    await next.click(); // → 正解
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz4/answer");
    await next.click(); // → 結果
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz4/result");
    await expect(host.page.getByText("全員不正解").first()).toBeVisible({ timeout: 30_000 });

    // 景品ダイアログは出ない。次へ → ロビー
    await next.click();
    await expect.poll(() => route(host.page)).toBe(`/session/host/${sessionId}`);
    await expect(host.page.getByText("おめでとうございます")).toBeHidden();

    await publish(request, sessionId, false);
    for (const d of [admin, host, hanako]) await d.context.close();
  });

  test("制限時間が来ればホストが何もしなくても受付が終わり、締切後の回答は拒否される", async ({ browser, request }) => {
    test.setTimeout(150_000);
    const { admin, host, sessionId } = await scene(browser, request, "締切会場", "qz2", 4);
    const phone = await login(browser, ids[0]);

    await admin.page.getByTestId("quiz-select").selectOption("qz2");
    await openAdvanced(admin.page);
    await admin.page.getByTestId("advanced").getByRole("button", { name: "出題" }).click();
    await expect(phone.page.getByTestId("quiz-panel")).toContainText("みかんはどれ?");
    // 4秒の制限時間が過ぎると、回答できなくなる(ボタンが無効 + 終了表示)
    await expect(phone.page.getByTestId("quiz-closed")).toBeVisible({ timeout: 20_000 });
    await expect(phone.page.getByRole("button", { name: /みかん/ })).toBeDisabled();
    await expect(host.page.getByText("受付終了。Enterで正解表示")).toBeVisible();

    await publish(request, sessionId, false);
    for (const d of [admin, host, phone]) await d.context.close();
  });

  test("ホストのリロードでも出題が続き、回答済みの人の回答は消えない", async ({ browser, request }) => {
    test.setTimeout(150_000);
    const { admin, host, sessionId } = await scene(browser, request, "再読込会場", "qz3", 90);
    const phone = await login(browser, ids[0]);

    await admin.page.getByTestId("quiz-select").selectOption("qz3");
    await openAdvanced(admin.page);
    await admin.page.getByTestId("advanced").getByRole("button", { name: "出題" }).click();
    await expect(phone.page.getByTestId("quiz-timer")).toBeVisible();
    await phone.page.getByRole("button", { name: /ぶどう/ }).click();
    await expect(phone.page.getByTestId("quiz-answered")).toContainText("3. ぶどう");

    await host.page.waitForTimeout(4000); // 時間を進めてからリロードする(やり直しなら残り時間が90に戻って判別できる)
    await host.page.reload(); // 出題中にホストがリロード
    await expect(admin.page.getByTestId("now")).toContainText("回答受付中");
    await expect(admin.page.getByTestId("quiz-state")).toContainText("回答 1 人"); // 回答は消えない
    // 残り時間は最初からやり直しではない(90秒のまま戻らない)。答えた人の画面では、残り時間の表示は出し続ける
    const text = await phone.page.getByTestId("quiz-timer").innerText();
    expect(Number(text.match(/\d+/)![0])).toBeLessThan(89);

    await publish(request, sessionId, false);
    for (const d of [admin, host, phone]) await d.context.close();
  });
});
