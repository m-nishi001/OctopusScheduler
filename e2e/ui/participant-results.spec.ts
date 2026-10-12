import type { APIRequestContext, Page } from "@playwright/test";
import { adminRpc, createSession, expect, newDevice, test } from "./fixtures";

/**
 * 参加者ポータルの「結果」タブ(スマホ幅の実ブラウザ)。
 *   - コンテンツ: クイズの順位・総合ランキング・自分の正誤、ジャックポットの当選履歴(自分の当選は強調)
 *   - タイムリーさ: ホストが結果を保存すると、開いている画面が数秒で更新される。別のタブにいる間は赤い印が付く
 *   - 見やすさ: 横スクロールが無く、タップ領域が十分で、空・読み込み中の状態が分かる
 * ホスト端末の代わりに、管理者のトークンで結果を保存し、更新番号(rev)を公開する(本番ではホストの HostAgent が行う)。
 */

const NAMES = ["太郎", "花子", "次郎"];
const ids = NAMES.map((_, i) => `rs-e2e-${String(i + 1).padStart(2, "0")}`);
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

/** ホスト端末の代わり: 管理者として入室して、結果の保存と更新番号の公開を行う。 */
async function fakeHost(request: APIRequestContext, sessionId: string) {
  const host = await adminRpc<{ deviceId: string; token: string }>(request, "sessionHub_joinOperator", {
    sessionId,
    role: "host",
    label: "E2E ホスト",
    deviceId: `rs-e2e-host-${sessionId}`,
  });
  const announce = (rev: number) =>
    adminRpc(request, "sessionHub_publishState", { sessionId, deviceId: host.deviceId, token: host.token, data: { results: { rev } }, clientInput: [] });
  return {
    async quiz(result: Record<string, unknown>) {
      const { rev } = await adminRpc<{ rev: number }>(request, "sessionHub_putQuizResult", { sessionId, result });
      await announce(rev);
    },
    async draw(draw: Record<string, unknown>) {
      const { rev } = await adminRpc<{ rev: number }>(request, "sessionHub_putJackpotDraw", { sessionId, draw });
      await announce(rev);
    },
    async removeDraw(drawId: string) {
      const { rev } = await adminRpc<{ rev: number }>(request, "sessionHub_deleteJackpotDraw", { sessionId, drawId });
      await announce(rev);
    },
  };
}

async function login(browser: import("@playwright/test").Browser, id: string) {
  const d = await newDevice(browser, { mobile: true });
  await d.page.goto(qrUrl(id));
  await expect(d.page.getByTestId("home-greeting")).toBeVisible();
  await expect(d.page.getByTestId("portal-conn")).toContainText("接続中");
  return d;
}

const noHorizontalScroll = async (page: Page) => {
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(sw, "横スクロールが出ない").toBeLessThanOrEqual(vw + 1);
};

const round = (over: Record<string, unknown>) => ({
  roundKey: "q1:live",
  quizId: "q1",
  title: "果物クイズ",
  correctNo: 2,
  closedAtMs: Date.now() - 60_000,
  answeredCount: 3,
  correct: [
    { memberId: ids[1], name: "花子", sec: 1.2 },
    { memberId: ids[0], name: "太郎", sec: 2.4 },
  ],
  wrongMemberIds: [ids[2]],
  ...over,
});

test.describe("参加者ポータル: 結果タブ", () => {
  test("空の状態 → ホストが結果を保存 → 開いている画面が更新される(順位・正誤・当選の強調)", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "結果会場");
    sessionIds.push(sessionId);
    await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });
    const host = await fakeHost(request, sessionId);

    const taro = await login(browser, ids[0]);
    const jiro = await login(browser, ids[2]);

    // --- 空の状態: 案内が出る。タブは3つあり、タップしやすい高さ
    await taro.page.getByRole("link", { name: "結果" }).click();
    await expect(taro.page.getByTestId("results-page")).toBeVisible();
    await expect(taro.page.getByTestId("results-quiz-empty")).toContainText("クイズの結果発表のあとに");
    await taro.page.getByTestId("results-tab-jackpot").click();
    await expect(taro.page.getByTestId("results-jackpot-empty")).toContainText("まだ当選者はいません");
    await taro.page.getByTestId("results-tab-quiz").click();
    const tabBox = await taro.page.getByRole("link", { name: "結果" }).boundingBox();
    expect(tabBox!.height).toBeGreaterThanOrEqual(48);
    await noHorizontalScroll(taro.page);

    // --- ホストがクイズの結果を保存 → 開いている画面が数秒で更新される(再読み込み不要)
    await host.quiz(round({}));
    await expect(taro.page.getByTestId("results-round")).toHaveCount(1, { timeout: 15_000 });
    await expect(taro.page.getByTestId("results-round-verdict")).toHaveText("正解 2位");
    await expect(taro.page.getByTestId("results-round")).toContainText("回答 3 人 / 正解 2 人");
    await expect(taro.page.getByTestId("results-my-rank")).toContainText("2 人中");
    // 総合ランキングの自分の行が強調され、「あなた」の印が付く
    await expect(taro.page.getByTestId("results-cumulative-mine")).toContainText("太郎");
    await expect(taro.page.getByTestId("results-cumulative-mine")).toContainText("あなた");

    // 次郎(不正解だった人)の画面には「不正解」と出る
    await jiro.page.getByRole("link", { name: "結果" }).click();
    await expect(jiro.page.getByTestId("results-round-verdict")).toHaveText("不正解", { timeout: 15_000 });

    // --- ジャックポットの当選: 自分(太郎)の当選は強調される
    await host.draw({ drawId: "d1", memberId: ids[0], memberName: "太郎", prizeId: "p1", prizeName: "1等 ペア旅行券", isKakuhen: false, atMs: Date.now() - 30_000 });
    await host.draw({ drawId: "d2", memberId: ids[1], memberName: "花子", prizeId: "p5", prizeName: "5等 スイーツ", isKakuhen: true, atMs: Date.now() - 10_000 });
    await taro.page.getByTestId("results-tab-jackpot").click();
    await expect(taro.page.getByTestId("results-draw")).toHaveCount(2, { timeout: 15_000 });
    await expect(taro.page.getByTestId("results-draw").first()).toContainText("5等 スイーツ"); // 新しい順
    await expect(taro.page.getByTestId("results-draw").first()).toContainText("確変");
    await expect(taro.page.getByTestId("results-draw-mine")).toHaveText("あなたが当選!");
    await expect(taro.page.getByTestId("results-my-wins")).toContainText("1");
    await noHorizontalScroll(taro.page);
    // 次郎は当選していないので強調は出ない
    await jiro.page.getByTestId("results-tab-jackpot").click();
    await expect(jiro.page.getByTestId("results-draw")).toHaveCount(2, { timeout: 15_000 });
    await expect(jiro.page.getByTestId("results-draw-mine")).toHaveCount(0);

    // --- 管理画面で取り消すと、当選履歴からも消える
    await host.removeDraw("d1");
    await expect(taro.page.getByTestId("results-draw")).toHaveCount(1, { timeout: 15_000 });
    await expect(taro.page.getByTestId("results-draw-mine")).toHaveCount(0);

    // 他の人のID(rs-e2e-…)は画面のどこにも出ない
    expect(await taro.page.content()).not.toContain(ids[1]);

    for (const d of [admin, taro, jiro]) await d.context.close();
  });

  test("別のタブにいる間に結果が保存されると、「結果」タブに赤い印が付き、開くと消える", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "印の会場");
    sessionIds.push(sessionId);
    await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });
    const host = await fakeHost(request, sessionId);
    const hanako = await login(browser, ids[1]);

    await expect(hanako.page.getByTestId("results-new")).toHaveCount(0);
    await host.quiz(round({ roundKey: "q9:live", quizId: "q9", title: "夜のクイズ" }));
    await expect(hanako.page.getByTestId("results-new")).toBeVisible({ timeout: 15_000 });

    await hanako.page.getByRole("link", { name: "結果" }).click();
    await expect(hanako.page.getByTestId("results-round")).toContainText("夜のクイズ");
    await expect(hanako.page.getByTestId("results-round-verdict")).toHaveText("正解 1位");
    await expect(hanako.page.getByTestId("results-new")).toHaveCount(0);

    // リロードしても(結果を直接開いた状態でも)結果が出る
    await hanako.page.reload();
    await expect(hanako.page.getByTestId("results-round")).toContainText("夜のクイズ", { timeout: 20_000 });

    for (const d of [admin, hanako]) await d.context.close();
  });
});
