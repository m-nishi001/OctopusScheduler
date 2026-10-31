import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { acceptConfirm, adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, openEventTab, route, sampleQuiz, seedRecord, test } from "./fixtures";
import { expectNoHorizontalOverflow, expectOverlayCenteredWithoutScroll, VIEWPORTS } from "./helpers/responsive";

/**
 * クイズの順位発表のネタバレ防止と「あなたは N 位!」。
 *   - 発表中: 参加者のスマホには「会場の画面をご覧ください」だけ。順位へのリンクも、自分の順位も、「結果」タブのこの回の結果も出ない。
 *   - 1位の祝福演出(会場の「1位 おめでとう」)が始まると: 結果の保存が済んでいるので、ほぼ同時に全画面で自分の順位
 *     (不正解・未回答は「今回は ランク外」)が出る。とじるボタンは無い。
 *   - 会場が順位発表の画面にいる間(景品のダイアログ中も)は出たまま。ロビーへ戻る、またはイベントを終えると消える。
 */

/** 会場の祝福演出が出てから、参加者の順位が出るまでの許容(ms)。以前は演出を見せ終える約6秒後だった。ポーリング間隔と通信の余裕を見込む。 */
const MAX_PORTAL_LAG_MS = 5000;

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

const seedQuiz = (page: Page, id: string, timeLimit = 60) => seedRecord(page, "quiz-game", "QuizList", [sampleQuiz(id, timeLimit)]);

async function login(browser: import("@playwright/test").Browser, id: string) {
  const d = await newDevice(browser, { mobile: true });
  await d.page.goto(qrUrl(id));
  await expect(d.page.locator(".pp-tabs")).toBeVisible();
  await expect(d.page.getByTestId("portal-conn")).toContainText("接続中");
  return d;
}

/** ホスト・管理・参加者3人を用意して、順位発表の画面(result)まで進める。 */
async function playToResult(browser: Browser, request: APIRequestContext, label: string, options: { event?: string } = {}) {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
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
  const jiro = await login(browser, ids[2]); // 回答しない

  if (options.event) {
    await openAdvanced(admin.page);
    await admin.page.getByTestId("event-title").fill(options.event);
    await admin.page.getByRole("button", { name: /^イベントを(開始|切り替える)$/ }).click();
    await expect(admin.page.getByTestId("event-state")).toContainText(options.event);
  }
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

  // 順位発表が始まる
  await next.click();
  await expect.poll(() => route(host.page)).toBe("/execute/quiz/qr1/result");
  return { admin, host, taro, hanako, jiro, next, sessionId, all: [admin, host, taro, hanako, jiro] };
}

type Results = { rev: number; quiz: { rounds: Array<{ title: string }> } };
const savedRounds = async (request: APIRequestContext, sessionId: string) =>
  (await adminRpc<Results>(request, "sessionHub_getResults", { sessionId })).quiz.rounds.length;

test.describe("クイズの順位発表(参加者ポータル)", () => {
  test("会場の1位の祝福演出とほぼ同時に自分の順位が出る(とじるボタンは無い)。景品の間は出たまま、ロビーへ戻ると消える", async ({ browser, request }) => {
    test.setTimeout(240_000);
    const { host, taro, hanako, jiro, next, sessionId, all } = await playToResult(browser, request, "順位発表会場");

    // 発表の間は、会場の画面を見るよう促すだけ
    for (const p of [taro.page, hanako.page]) {
      await expect(p.getByTestId("quiz-reveal-watch")).toContainText("会場の画面をご覧ください");
      await expect(p.getByTestId("quiz-results-link")).toHaveCount(0);
      await expect(p.getByTestId("quiz-my-rank")).toHaveCount(0);
      await expect(p.getByText("順位を見る")).toHaveCount(0);
    }
    // 結果タブにも、この回の結果と新着の印は出ない
    await expect(jiro.page.getByTestId("results-quiz-held")).toBeVisible();
    await expect(jiro.page.getByTestId("results-round")).toHaveCount(0);
    await expect(jiro.page.getByTestId("results-new")).toHaveCount(0);
    await expect(jiro.page.getByTestId("quiz-my-rank")).toHaveCount(0);

    // 会場の祝福演出と、参加者の順位の表示が出る時刻を測る
    const banner = host.page.locator(".banner-label");
    const at = async (loc: ReturnType<Page["locator"]>) => {
      await expect(loc).toBeVisible({ timeout: 60_000 });
      return Date.now();
    };
    const [hostAt, taroAt, hanakoAt, jiroAt] = await Promise.all([
      at(banner),
      at(taro.page.getByTestId("quiz-my-rank")),
      at(hanako.page.getByTestId("quiz-my-rank")),
      at(jiro.page.getByTestId("quiz-my-rank")),
    ]);
    const lags = [taroAt, hanakoAt, jiroAt].map((t) => t - hostAt);
    console.log(`会場の祝福演出 → 参加者の順位の表示(ms): ${lags.join(", ")}`);
    for (const lag of lags) expect(lag).toBeLessThan(MAX_PORTAL_LAG_MS);

    // 出た時点で結果は保存済み。とじるボタンは無い
    expect(await savedRounds(request, sessionId)).toBe(1);
    for (const p of [taro.page, hanako.page, jiro.page]) await expect(p.getByTestId("quiz-my-rank-close")).toHaveCount(0);
    await expect(taro.page.getByTestId("quiz-my-rank-text")).toHaveText("1位!");
    // 全画面(390x844 のスマホ)。出現のアニメーションが終わるのを待って測る
    await expect.poll(async () => taro.page.getByTestId("quiz-my-rank").boundingBox()).toMatchObject({ x: 0, y: 0, ...VIEWPORTS.phone });
    await expect(hanako.page.getByTestId("quiz-my-rank-text")).toHaveText("今回は ランク外");
    await expect(hanako.page.getByTestId("quiz-my-rank-sub")).toContainText("不正解");
    await expect(jiro.page.getByTestId("quiz-my-rank-text")).toHaveText("今回は ランク外");
    await expect(jiro.page.getByTestId("quiz-my-rank-sub")).toContainText("回答していません");
    // 結果タブにいた人は、開き直さなくても今回の結果が見える(裏で開いている)
    await expect(jiro.page.getByTestId("results-quiz-held")).toHaveCount(0);

    // タブレット・横向きでも全画面で、はみ出さない
    for (const size of [VIEWPORTS.tablet, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
      for (const d of [taro, hanako]) {
        await d.page.setViewportSize(size);
        await expect.poll(async () => d.page.getByTestId("quiz-my-rank").boundingBox(), `${size.width}x${size.height}`).toMatchObject({ x: 0, y: 0, ...size });
        await expect(d.page.getByTestId("quiz-my-rank-text")).toBeInViewport();
        await expectNoHorizontalOverflow(d.page, `順位 ${size.width}x${size.height}`);
      }
    }
    await taro.page.setViewportSize(VIEWPORTS.phone);
    await hanako.page.setViewportSize(VIEWPORTS.phone);

    // 会場の祝福演出が終わるまで待ってから「次へ」で景品。景品のダイアログが出ている間も、順位は出たまま
    await expect(banner).toBeHidden({ timeout: 30_000 });
    // (会場の演出が完全に終わる前の「次へ」は何も起きないので、景品が出るまで押し直す)
    await expect(async () => {
      await next.click();
      await expect(host.page.getByText("おめでとうございます")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await host.page.waitForTimeout(2000);
    await expect(taro.page.getByTestId("quiz-my-rank")).toBeVisible();
    await expect(hanako.page.getByTestId("quiz-my-rank")).toBeVisible();

    // もう一度「次へ」でロビーへ。順位の全画面は消え、通常の表示(クイズの表示なし)に戻る
    await next.click();
    await expect.poll(() => route(host.page)).toBe(`/session/host/${sessionId}`);
    await expect(taro.page.getByTestId("quiz-my-rank")).toHaveCount(0);
    await expect(hanako.page.getByTestId("quiz-my-rank")).toHaveCount(0);
    await expect(jiro.page.getByTestId("quiz-my-rank")).toHaveCount(0);
    await expect(jiro.page.getByTestId("results-round").first()).toContainText("果物クイズ");
    await openEventTab(taro.page);
    await expect(taro.page.getByTestId("quiz-panel")).toHaveCount(0);

    await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: false });
    for (const d of all) await d.context.close();
  });

  // 長い進行(景品の「次へ」)の途中に挟むと、ホストの演出の待ち時間とずれて不安定になるため、独立したテストにする
  test("順位の全画面は、どの画面の大きさでも縦の真ん中に出て、縦スクロールが出ない(1位の紙吹雪の間も)", async ({ browser, request }) => {
    test.setTimeout(240_000);
    const { taro, hanako, sessionId, all } = await playToResult(browser, request, "順位発表の寸法会場");
    await expect(taro.page.getByTestId("quiz-my-rank-text")).toHaveText("1位!", { timeout: 60_000 });
    await expect(hanako.page.getByTestId("quiz-my-rank-text")).toHaveText("今回は ランク外");
    // 横向きは枠そのものがスクロールしないことだけを見る
    for (const size of [{ width: 412, height: 915 }, { width: 360, height: 640 }, VIEWPORTS.tablet, { width: 844, height: 390 }]) {
      const landscape = size.width > size.height && size.height < 500;
      for (const [d, name] of [[taro, "rank1"], [hanako, "out"]] as const) {
        await d.page.setViewportSize(size);
        await expect(d.page.getByTestId("quiz-my-rank-text")).toBeInViewport();
        await expectOverlayCenteredWithoutScroll(d.page, "quiz-my-rank", `順位(${name}) ${size.width}x${size.height}`, {
          landscape,
          shotPrefix: `${name}-${size.width}x${size.height}`,
        });
      }
    }

    await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: false });
    for (const d of all) await d.context.close();
  });

  test("順位が出たまま管理端末で「イベントを終了」すると、順位の全画面も消える", async ({ browser, request }) => {
    test.setTimeout(240_000);
    const { admin, host, taro, hanako, sessionId, all } = await playToResult(browser, request, "順位発表の終了会場", { event: "果物クイズ大会" });

    await expect(taro.page.getByTestId("quiz-my-rank")).toBeVisible({ timeout: 60_000 });
    await expect(hanako.page.getByTestId("quiz-my-rank")).toBeVisible();
    // 会場はまだ順位発表の画面のまま
    expect(await route(host.page)).toBe("/execute/quiz/qr1/result");

    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "イベントを終了" }).click();
    await acceptConfirm(admin.page);
    await expect(admin.page.getByTestId("event-state")).toContainText("イベントは開催していません");
    await expect(taro.page.getByTestId("quiz-my-rank")).toHaveCount(0);
    await expect(hanako.page.getByTestId("quiz-my-rank")).toHaveCount(0);
    await expect(taro.page.getByTestId("event-banner")).toHaveCount(0);

    await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: false });
    for (const d of all) await d.context.close();
  });
});
