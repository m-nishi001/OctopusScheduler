import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { acceptConfirm, adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, route, seedStore, test, type Device } from "./fixtures";

/**
 * ジャックポットの抽選状態(当選者・景品の在庫・確変の予定)は、ホストの端末ではなくセッションの結果ファイル(サーバー)が正本。
 *   (a) ホストの再読み込みで、演出の途中でも同じ当選者・景品で演出し直す(引き直さない)
 *   (b) 同じセッションの2回目のイベントでも、当選した人・景品は二度出ない
 *   (c) 3人のジャックポットは3回で終わり、終了の画面に「対象の 3 名」と出る(結果のシードは無い)
 *   (d) 管理画面のリセットで、当選者・景品がもう一度出るようになる
 * 参加者は別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは終わったら消す。
 */

const MEMBER_COUNT = 4;
const ids = Array.from({ length: MEMBER_COUNT }, (_, i) => `jp-state-${i + 1}`);
const nameOf = (id: string) => `状態${id.slice(-1)}`;
const keys = new Map<string, string>();
const sessionIds: string[] = [];
const PRIZES = Array.from({ length: 8 }, (_, i) => ({ id: `jp-state-p${i + 1}`, name: `状態景品${i + 1}`, order: i + 1, weight: 10 }));

const qrUrl = (id: string) => `/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(keys.get(id)!)}`;

interface ServerDraw {
  drawId: string;
  memberId: string;
  memberName: string;
  prizeId: string;
  prizeName: string;
  isKakuhen: boolean;
  revealedAtMs: number | null;
}
interface ServerState {
  rev: number;
  plan: { kakuhenTimings: number[]; reservedPrizeIds: string[] } | null;
  draws: ServerDraw[];
}

const serverState = (request: APIRequestContext, sessionId: string) => adminRpc<ServerState>(request, "sessionHub_getJackpotState", { sessionId });
const revealedCount = async (request: APIRequestContext, sessionId: string) =>
  (await serverState(request, sessionId)).draws.filter((d) => d.revealedAtMs !== null).length;

test.beforeAll(async ({ request }) => {
  for (const id of ids) {
    await adminRpc(request, "accounts_addMember", { id, name: nameOf(id) });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

interface Scene {
  admin: Device;
  host: Device;
  sessionId: string;
  guests: Device[];
}

/** 管理・ホスト(投影)を開き、景品を入れる。参加者は `memberCount` 人がログインして、イベントにエントリーする。 */
async function scene(browser: Browser, request: APIRequestContext, label: string, memberCount: number): Promise<Scene> {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toContainText(label);
  await seedStore(host.page, "jackpot-game", "PrizeData", PRIZES.map((p) => ({ id: p.id, value: p })));
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });
  const guests = await Promise.all(ids.slice(0, memberCount).map(() => newDevice(browser, { mobile: true })));
  await Promise.all(guests.map((g, i) => g.page.goto(qrUrl(ids[i]))));
  await startEvent(admin.page, guests, "状態の抽選会");
  return { admin, host, sessionId, guests };
}

/** イベントを始めて受付を開き、参加者全員がエントリーする(抽選の対象は、エントリーした人だけ)。 */
async function startEvent(admin: Page, guests: Device[], title: string): Promise<void> {
  await openAdvanced(admin);
  await admin.getByTestId("event-title").fill(title);
  await admin.getByRole("button", { name: "イベントを開始" }).click();
  await admin.getByRole("button", { name: "エントリー受付を開始" }).click();
  for (const [i, g] of guests.entries()) {
    await expect(g.page.getByTestId("event-banner"), ids[i]).toBeVisible();
    await g.page.getByTestId("event-banner").click();
    await g.page.getByTestId("entry-button").click();
    await expect(g.page.getByTestId("entry-done")).toBeVisible();
  }
  await expect(admin.getByTestId("entry-count")).toHaveText(`${guests.length}`);
}

/** 管理端末から、ホストを抽選画面へ進める。 */
async function openDraw(admin: Page, host: Page): Promise<void> {
  await openAdvanced(admin);
  await admin.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect.poll(() => route(host)).toBe("/execute/jackpot-draw");
  await expect(admin.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
}

/** 管理端末の画面の表示(進行が進むと変わる)。 */
const consoleText = async (admin: Page) =>
  [await admin.getByTestId("now").innerText(), await admin.getByTestId("jackpot-state").innerText(), await admin.getByTestId("next-hint").innerText().catch(() => "")].join("|");

/**
 * 条件を満たすまで、管理端末の「次へ」で進める。1回押したら画面が変わるのを待つ(通信が遅い環境で、
 * 届く前に押し重ねて、画面が見える前に先へ進めすぎないため)。変わらなければ(押したコマンドが届かなかったとき)押し直す。
 */
async function stepUntil(admin: Page, done: () => Promise<boolean>, what: string, maxSteps = 120): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await done()) return;
    const before = await consoleText(admin);
    await nextButton(admin).click();
    await expect.poll(async () => (await consoleText(admin)) !== before, { timeout: 6_000 }).toBe(true).catch(() => undefined);
  }
  throw new Error(`${what}: ${maxSteps} 回進めても満たされない`);
}

/** 参加者の画面を閉じ、後始末する。 */
const closeAll = async (s: Scene) => {
  for (const d of [s.admin, s.host, ...s.guests]) await d.context.close();
};

test("(a) ホストを再読み込みしても、演出の途中だった抽選は引き直さず、同じ当選者・景品で演出し直す", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const s = await scene(browser, request, "再読み込み会場", 3);
  await openDraw(s.admin.page, s.host.page);

  // 当選者が画面に見えた(= サーバーには確定済みだが、まだ公開していない)ところまで進める
  await stepUntil(s.admin.page, async () => /当選者: 状態\d/.test(await s.admin.page.getByTestId("jackpot-state").innerText()), "当選者が見える");
  const before = (await serverState(request, s.sessionId)).draws;
  expect(before).toHaveLength(1);
  expect(before[0].revealedAtMs, "景品が見えるまで、参加者には公開されない").toBeNull();

  await s.host.page.reload();
  await expect.poll(() => route(s.host.page)).toBe("/execute/jackpot-draw");
  await expect(s.admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });

  // 演出し直し: 同じ当選者になる。引き直されていない(サーバーの確定は1件のまま)
  await stepUntil(s.admin.page, async () => /当選者: 状態\d/.test(await s.admin.page.getByTestId("jackpot-state").innerText()), "当選者が見える(再読み込み後)");
  await expect(s.admin.page.getByTestId("jackpot-state")).toContainText(`当選者: ${before[0].memberName}`);
  await stepUntil(s.admin.page, async () => (await revealedCount(request, s.sessionId)) === 1, "景品が見えて公開される");
  const after = (await serverState(request, s.sessionId)).draws;
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ drawId: before[0].drawId, memberId: before[0].memberId, prizeId: before[0].prizeId });
  expect(after[0].revealedAtMs).not.toBeNull();
  await closeAll(s);
});

test("(b)(c) 同じセッションの2回目のイベントでも、当選した人・景品は二度出ない。対象の全員が当選したら、人数つきの終了の画面になる", async ({ browser, request }) => {
  test.setTimeout(480_000);
  const s = await scene(browser, request, "イベント跨ぎ会場", 3);
  const { admin, host, sessionId } = s;
  await openDraw(admin.page, host.page);

  // 1回目のイベント: 1人だけ当選させる
  await stepUntil(admin.page, async () => (await revealedCount(request, sessionId)) === 1, "1回目の抽選が公開される");
  const first = (await serverState(request, sessionId)).draws[0];

  // イベントを終え、ホストをロビーへ戻す
  await admin.page.getByTestId("end-event").click();
  await acceptConfirm(admin.page);
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();

  // 2回目のイベント(エントリーし直す): 最後まで引き切る。残りは2人 = 合計3回で、対象の3名全員になる
  await startEvent(admin.page, s.guests, "状態の抽選会 第2部");
  await openDraw(admin.page, host.page);
  await stepUntil(admin.page, async () => host.page.getByTestId("end-dialog").isVisible().catch(() => false), "終了の画面が出る", 200);

  const state = await serverState(request, sessionId);
  const members = state.draws.map((d) => d.memberId);
  const prizes = state.draws.map((d) => d.prizeId);
  expect(state.draws, "3名が1回ずつ当選する").toHaveLength(3);
  expect(new Set(members).size, "同じ人が二度当選していない").toBe(3);
  expect(new Set(prizes).size, "同じ景品が二度出ていない").toBe(3);
  expect(state.draws[0].drawId, "1回目のイベントの当選は残っている").toBe(first.drawId);
  expect(state.draws.every((d) => d.revealedAtMs !== null)).toBe(true);
  expect(state.plan, "確変の予定はセッションで最初に決めたものが残る").not.toBeNull();

  // 終了の理由は「メンバーが尽きた」。人数が出るので、原因を画面から判断できる
  await expect(host.page.getByTestId("end-dialog")).toHaveAttribute("data-reason", "members");
  await expect(host.page.getByTestId("end-message")).toHaveText("対象の 3 名全員の抽選が終わりました。");
  await closeAll(s);
});

test("(d) 管理画面の結果のリセットで、当選者・景品の記録が消え、もう一度抽選できる", async ({ browser, request }) => {
  test.setTimeout(420_000);
  const s = await scene(browser, request, "リセット会場", 2);
  const { admin, host, sessionId } = s;
  await openDraw(admin.page, host.page);
  await stepUntil(admin.page, async () => (await revealedCount(request, sessionId)) === 1, "1回目の抽選が公開される");
  const first = (await serverState(request, sessionId)).draws[0];
  expect((await serverState(request, sessionId)).plan).not.toBeNull();

  // 管理画面の結果ページ: セッションを選ぶと、そのセッションの抽選結果が見える。リセットする
  const results = await newDevice(browser, { signedIn: true });
  await results.page.goto("/#/execute/jackpot-admin/results");
  await results.page.getByTestId("results-source").selectOption(sessionId);
  await expect(results.page.getByTestId("total-draws")).toHaveText("1");
  await expect(results.page.getByTestId("reserved-badge").first()).toBeVisible(); // 確変用に取り置いた景品の印(予定から)
  await results.page.getByRole("button", { name: "結果をリセット" }).click();
  await acceptConfirm(results.page, "リセット");
  await expect(results.page.getByTestId("total-draws")).toHaveText("0");
  const reset = await serverState(request, sessionId);
  expect(reset.draws).toEqual([]);
  expect(reset.plan).toBeNull();

  // 続きの抽選: ホストは次の抽選の前に保存先を読み直すので、記録が消えたことを取り込んで、新しく引く
  await stepUntil(admin.page, async () => (await serverState(request, sessionId)).draws.some((d) => d.drawId !== first.drawId), "リセット後の新しい抽選が確定される");
  const after = await serverState(request, sessionId);
  expect(after.draws.every((d) => d.drawId !== first.drawId)).toBe(true);
  expect(after.plan, "確変の予定が決め直される").not.toBeNull();
  await results.context.close();
  await closeAll(s);
});
