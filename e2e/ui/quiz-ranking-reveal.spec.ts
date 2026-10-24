import type { APIRequestContext, Page } from "@playwright/test";
import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, openEventTab, route, sampleQuiz, seedStore, test } from "./fixtures";

/**
 * クイズの順位発表のネタバレ防止と「あなたは N 位!」。
 *   - 発表中: 参加者のスマホには「会場の画面をご覧ください」だけ。順位へのリンクも、自分の順位も、「結果」タブのこの回の結果も出ない。
 *   - 発表が終わると: 結果の保存が済んでから、全画面で自分の順位(不正解・未回答は「今回は ランク外」)が出る。
 *   - ホストがロビーへ戻ると: 通常の表示に戻る。
 */

const NAMES = ["太郎", "花子", "次郎"];
const ids = NAMES.map((_, i) => `qr-e2e-${String(i + 1).padStart(2, "0")}`);
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

const seedQuiz = (page: Page, id: string, timeLimit = 60) => seedStore(page, "quiz-game", "QuizData", [{ id, value: sampleQuiz(id, timeLimit) }]);

async function login(browser: import("@playwright/test").Browser, id: string) {
  const d = await newDevice(browser, { mobile: true });
  await d.page.goto(qrUrl(id));
  await expect(d.page.locator(".pp-tabs")).toBeVisible();
  await expect(d.page.getByTestId("portal-conn")).toContainText("接続中");
  return d;
}

type Results = { rev: number; quiz: { rounds: Array<{ title: string }> } };
const savedRounds = async (request: APIRequestContext, sessionId: string) =>
  (await adminRpc<Results>(request, "sessionHub_getResults", { sessionId })).quiz.rounds.length;

test.describe("クイズの順位発表(参加者ポータル)", () => {
  test("発表中は順位を出さず、終わると自分の順位を大きく出し、ロビーへ戻ると通常の表示に戻る", async ({ browser, request }) => {
    test.setTimeout(240_000);
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "順位発表会場");
    sessionIds.push(sessionId);
    await seedQuiz(admin.page, "qr1");
    await admin.page.reload();
    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();
    await seedQuiz(host.page, "qr1");
    await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });

    const taro = await login(browser, ids[0]); // 正解(1位)
    const hanako = await login(browser, ids[1]); // 不正解
    const jiro = await login(browser, ids[2]); // 回答しない。順位発表の間は「結果」タブを開いておく

    await admin.page.getByTestId("quiz-select").selectOption("qr1");
    await openAdvanced(admin.page);
    await admin.page.getByTestId("advanced").getByRole("button", { name: "出題" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qr1/play");
    await taro.page.getByRole("button", { name: /みかん/ }).click(); // 正解
    await expect(taro.page.getByTestId("quiz-answered")).toContainText("2. みかん");
    await hanako.page.getByRole("button", { name: /りんご/ }).click(); // 不正解
    await expect(hanako.page.getByTestId("quiz-answered")).toContainText("1. りんご");

    await nextButton(admin.page).click(); // 受付を締め切る
    const next = nextButton(admin.page);
    await expect(next).not.toContainText("締め切る");
    await next.click(); // → 正解発表
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qr1/answer");
    await expect(taro.page.getByTestId("quiz-verdict")).toHaveText("正解！");
    await jiro.page.getByRole("link", { name: "結果" }).click();
    await expect(jiro.page.getByTestId("results-page")).toBeVisible();

    // 順位発表が始まる。発表の間は、会場の画面を見るよう促すだけ
    await next.click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qr1/result");
    for (const p of [taro.page, hanako.page]) {
      await expect(p.getByTestId("quiz-reveal-watch")).toContainText("会場の画面をご覧ください");
      await expect(p.getByTestId("quiz-results-link")).toHaveCount(0);
      await expect(p.getByTestId("quiz-my-rank")).toHaveCount(0);
      await expect(p.getByText("順位を見る")).toHaveCount(0);
    }
    // 結果の保存は、発表が終わってから。結果タブにも、この回の結果と新着の印は出ない
    expect(await savedRounds(request, sessionId)).toBe(0);
    await expect(jiro.page.getByTestId("results-quiz-held")).toBeVisible();
    await expect(jiro.page.getByTestId("results-round")).toHaveCount(0);
    await expect(jiro.page.getByTestId("results-new")).toHaveCount(0);
    await expect(jiro.page.getByTestId("quiz-my-rank")).toHaveCount(0);

    // 発表が終わると、保存が済んだうえで、全画面で自分の順位が出る
    await expect(taro.page.getByTestId("quiz-my-rank")).toBeVisible({ timeout: 60_000 });
    expect(await savedRounds(request, sessionId)).toBe(1);
    await expect(taro.page.getByTestId("quiz-my-rank-text")).toHaveText("1位!");
    // 全画面(390x844 のスマホ)。出現のアニメーションが終わるのを待って測る
    await expect.poll(async () => taro.page.getByTestId("quiz-my-rank").boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
    await expect(hanako.page.getByTestId("quiz-my-rank-text")).toHaveText("今回は ランク外");
    await expect(hanako.page.getByTestId("quiz-my-rank-sub")).toContainText("不正解");
    await expect(jiro.page.getByTestId("quiz-my-rank-text")).toHaveText("今回は ランク外");
    await expect(jiro.page.getByTestId("quiz-my-rank-sub")).toContainText("回答していません");

    // 閉じると結果タブに今回の結果が出ている(結果タブにいた人は、開き直さなくても)
    await jiro.page.getByTestId("quiz-my-rank-close").click();
    await expect(jiro.page.getByTestId("results-quiz-held")).toHaveCount(0);
    await expect(jiro.page.getByTestId("results-round").first()).toContainText("果物クイズ");

    // 「次へ」で景品、もう一度でロビーへ。順位の全画面は消え、通常の表示(クイズの表示なし)に戻る
    await next.click();
    await expect(host.page.getByText("おめでとうございます")).toBeVisible();
    await next.click();
    await expect.poll(() => route(host.page)).toBe(`/session/host/${sessionId}`);
    await expect(taro.page.getByTestId("quiz-my-rank")).toHaveCount(0);
    await expect(hanako.page.getByTestId("quiz-my-rank")).toHaveCount(0);
    await openEventTab(taro.page);
    await expect(taro.page.getByTestId("quiz-panel")).toHaveCount(0);

    await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: false });
    for (const d of [admin, host, taro, hanako, jiro]) await d.context.close();
  });
});
