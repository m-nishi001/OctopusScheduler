import type { Browser, Page } from "@playwright/test";
import { devices } from "@playwright/test";
import { adminRpc, createSession, expect, isGas, newDevice, publishPortal, test } from "./fixtures";
import { fakeHost } from "./helpers/fake-host";
import { expectFitsEverySize } from "./helpers/responsive";

/**
 * 参加者ポータルが「どの端末でも」横にはみ出さない(横スクロールが出ない)こと。
 *   - 幅を連続的に掃引(280〜1100・横向き・文字拡大)しても、画面の端を越える要素が出ない
 *   - 実機のプリセット(iPhone SE / Pixel / iPad など)で開いても同じ
 * 長い名前・長いクイズ名・長い景品名・英数字だけの選択肢など、折り返されにくい内容を入れて確かめる。
 * ホストの代わりに fakeHost が公開状態を差し替え、各状態の画面を順に見る。
 */

const LONG = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
const LONG_NAME = "とても長い名前の参加者ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ids = ["rp-e2e-01", "rp-e2e-02"];
const names = [LONG_NAME, "花子"];
const keys = new Map<string, string>();
const sessionIds: string[] = [];

/** 端末の寸法ごとの確認は幅の掃引が担う。ここは実機の特性(devicePixelRatio・タッチ・UA)での確認。 */
const DEVICE_PRESETS = ["iPhone SE", "iPhone 13 Mini", "iPhone 15 Pro Max", "Pixel 7", "Galaxy S9+", "iPad Mini", "iPad Pro 11", "iPhone SE landscape", "Pixel 7 landscape"] as const;

test.beforeAll(async ({ request }) => {
  for (const [i, id] of ids.entries()) {
    await adminRpc(request, "accounts_addMember", { id, name: names[i] });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

async function loginAs(browser: Browser, id: string, preset?: (typeof DEVICE_PRESETS)[number]) {
  const context = await browser.newContext(preset ? devices[preset] : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(keys.get(id)!)}`);
  await expect(page.getByTestId("home-greeting")).toBeVisible();
  await expect(page.getByTestId("portal-conn")).toContainText("接続中");
  return { context, page };
}

const go = (page: Page, path: string) => page.evaluate((p) => (location.hash = p), path);

test("参加者ポータル: 幅の掃引と実機プリセットで、どの画面も横にはみ出さない", async ({ browser, request }) => {
  // GAS では、ホストの公開が各端末に届くまでがポーリング(数秒)なので、状態を切り替えるたびの待ちが長い
  test.setTimeout(isGas ? 900_000 : 720_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "レスポンシブ会場");
  sessionIds.push(sessionId);
  await publishPortal(request, sessionId);
  const host = await fakeHost(request, sessionId);

  // 長い内容の結果: 多人数のランキング・長いクイズ名・長い景品名(自分の当選・確変を含む)
  await host.quiz({
    roundKey: "q1:live",
    quizId: "q1",
    title: `長いクイズ名${LONG}`,
    correctNo: 2,
    closedAtMs: Date.now() - 60_000,
    answeredCount: 40,
    correct: [
      { memberId: ids[0], name: LONG_NAME, sec: 1.2 },
      ...Array.from({ length: 30 }, (_, i) => ({ memberId: `rp-other-${i}`, name: `${LONG}${i}`, sec: 2 + i / 10 })),
    ],
    wrongMemberIds: [ids[1]],
  });
  await host.draw({ drawId: "d1", memberId: ids[0], memberName: LONG_NAME, prizeId: "p1", prizeName: `1等 ${LONG}`, isKakuhen: true, atMs: Date.now() - 30_000 });
  await host.draw({ drawId: "d2", memberId: ids[1], memberName: `${LONG}`, prizeId: "p2", prizeName: `https://example.com/${LONG}/${LONG}`, isKakuhen: false, atMs: Date.now() - 10_000 });

  const clients = [
    await loginAs(browser, ids[0]),
    ...(await Promise.all(DEVICE_PRESETS.map((p) => loginAs(browser, ids[0], p)))),
  ];

  // 端末の組み合わせは、小型スマホ・横向き・タブレットを含む代表に絞れる(時間がかかるため、ジャックポットの各状態で使う)
  const REPRESENTATIVE = new Set([0, 1, 7, 8]);
  const check = async (state: string, routes: Array<{ path: string; ready: (page: Page) => Promise<void> }>, onlyRepresentative = false) => {
    for (const [i, c] of clients.entries()) {
      if (onlyRepresentative && !REPRESENTATIVE.has(i)) continue;
      const device = i === 0 ? "phone" : DEVICE_PRESETS[i - 1];
      for (const r of routes) {
        await go(c.page, r.path);
        await r.ready(c.page);
        await expectFitsEverySize(c.page, `[${device}] ${state} ${r.path}`);
      }
    }
  };

  // 1. イベントなし: ホーム・結果(クイズ/ジャックポット)・マイページ
  await check("待機", [
    { path: "/p", ready: (p) => expect(p.getByTestId("home-status")).toBeVisible() },
    { path: "/p/me", ready: (p) => expect(p.getByTestId("me-name")).toBeVisible() },
    { path: "/p/results", ready: (p) => expect(p.getByTestId("results-round")).toBeVisible() },
  ]);
  for (const c of clients) {
    await go(c.page, "/p/results");
    await c.page.getByTestId("results-tab-jackpot").click();
    await expect(c.page.getByTestId("results-draw").first()).toBeVisible();
  }
  await check("結果(ジャックポット)", [{ path: "/p/results", ready: (p) => expect(p.getByTestId("results-draw").first()).toBeVisible() }]);

  // 2. イベント発生中・エントリー受付中(長いイベント名)
  await host.publish({ event: { id: "ev1", title: `長いイベント名${LONG}`, startedAtMs: Date.now(), entry: { key: "e1", open: true } } });
  await check("エントリー受付", [
    { path: "/p/event", ready: (p) => expect(p.getByTestId("entry-button")).toBeVisible() },
    { path: "/p", ready: (p) => expect(p.getByTestId("entry-button")).toBeVisible() },
  ]);

  // 3. クイズ出題中(長い問題文・英数字だけの選択肢)
  await host.publish({
    quiz: {
      page: "play",
      phase: "answering",
      title: `長いクイズ名${LONG}`,
      roundKey: "q2:live",
      deadlineMs: Date.now() + 10 * 60_000,
      question: `これは長い問題文です。${LONG}${LONG}`,
      options: [1, 2, 3, 4].map((no) => ({ no, text: `${LONG}${LONG}${no}`, color: "#ef4444" })),
      correctNo: null,
    },
  });
  await check("クイズ出題", [{ path: "/p/event", ready: (p) => expect(p.getByTestId("quiz-panel")).toContainText("これは長い問題文") }]);

  // 4. ジャックポット: 待機 → メンバー抽選中 → 他の人が当選 → 景品抽選中 → 景品が決まる(長い名前・長い景品名)
  const jackpot = { page: "main-draw", canStop: false, member: null, memberId: null, prize: null };
  // 対象が自動のイベント(エントリーしなくても対象)なので、待機画面が出る
  await host.publish({ event: { id: "ev1", title: `長いイベント名${LONG}`, startedAtMs: Date.now(), pool: "all" }, quiz: null, jackpot: { ...jackpot, stage: "waiting" } });
  await check("ジャックポット待機", [{ path: "/p/event", ready: (p) => expect(p.getByTestId("jackpot-waiting-title")).toContainText("まもなく抽選") }], true);
  await host.publish({ jackpot: { ...jackpot, stage: "member" } });
  await check("メンバー抽選中", [{ path: "/p/event", ready: (p) => expect(p.getByTestId("jackpot-waiting-title")).toContainText("メンバー抽選中") }], true);
  await host.publish({ jackpot: { ...jackpot, stage: "member-revealed", member: `${LONG}${LONG}`, memberId: "rp-other-0" } });
  await check("他の人が当選", [{ path: "/p/event", ready: (p) => expect(p.getByTestId("winner-member")).toContainText(LONG) }], true);
  await host.publish({ jackpot: { ...jackpot, stage: "prize", member: `${LONG}${LONG}`, memberId: "rp-other-0" } });
  await check("景品抽選中", [{ path: "/p/event", ready: (p) => expect(p.getByTestId("jackpot-waiting-title")).toContainText("景品抽選中") }], true);
  await host.publish({ jackpot: { ...jackpot, stage: "prize-revealed", member: `${LONG}${LONG}`, memberId: "rp-other-0", prize: `特賞 ${LONG}${LONG}` } });
  await check("景品が決まる", [{ path: "/p/event", ready: (p) => expect(p.getByTestId("winner-prize")).toContainText("特賞") }], true);
  // 自分が当選: 全面の「あたりました!」が、どの端末でも画面に収まる(閉じるボタンは無く、景品抽選に進めば自動で消える)
  await host.publish({ jackpot: { ...jackpot, stage: "member-revealed", member: LONG_NAME, memberId: ids[0], prize: null } });
  for (const c of clients) {
    await go(c.page, "/p");
    await expect(c.page.getByTestId("you-won")).toBeVisible();
    await expect(c.page.getByTestId("you-won-name")).toBeInViewport();
    await expect(c.page.getByTestId("you-won-close")).toHaveCount(0);
  }
  await check("自分が当選", [{ path: "/p", ready: (p) => expect(p.getByTestId("you-won-name")).toContainText("さん") }], true);
  await host.publish({ jackpot: { ...jackpot, stage: "prize", member: LONG_NAME, memberId: ids[0], prize: null } });
  for (const c of clients) {
    await expect(c.page.getByTestId("you-won")).toBeHidden();
  }

  for (const c of clients) await c.context.close();
  await admin.context.close();
});
