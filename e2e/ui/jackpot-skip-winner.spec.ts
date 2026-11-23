import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { acceptConfirm, adminRpc, createSession, expect, loginByQr, newDevice, nextButton, openAdvanced, route, seedJackpot, test, type Device } from "./fixtures";

/**
 * 不在の当選者を飛ばす(管理コンソールの「この人を飛ばす(不在)」)。
 *   (a) 確変の回(メンバー発表後)と通常の回(景品の結果表示中)で1回ずつ飛ばし、そのまま最後まで通す。
 *       景品・確変の回は変わらず、飛ばした人はあとの抽選にも出ない。同じ人・同じ景品の重複は0。
 *   (b) 飛ばしたあと、新しい当選者を公開する前にホストを再読み込みしても、置き換え後の当選者で演出し直す(飛ばした人は戻らない)。
 *   (c) 参加者の当選履歴: 飛ばした時点で一度消え、新しい当選者を見せ終えると新しい当選者で出る。
 * 参加者は別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは終わったら消す。
 */

const ids = Array.from({ length: 5 }, (_, i) => `jp-skip-${i + 1}`);
const nameOf = (id: string) => `飛ばし${id.slice(-1)}`;
const keys = new Map<string, string>();
const sessionIds: string[] = [];
const PRIZES = Array.from({ length: 8 }, (_, i) => ({ id: `jp-skip-p${i + 1}`, name: `飛ばし景品${i + 1}`, order: i + 1, rank: 3 }));

interface ServerDraw {
  drawId: string;
  memberId: string;
  memberName: string;
  prizeId: string;
  isKakuhen: boolean;
  revealedAtMs: number | null;
}
interface ServerState {
  rev: number;
  plan: { kakuhenTimings: number[]; reservedPrizeIds: string[] } | null;
  excludedMemberIds: string[];
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

/**
 * 管理・ホスト(投影)を開き、景品を入れ、5人の参加者がログインして(抽選の対象は参加者全員(自動))、ホストを抽選画面へ進める。
 * 確変の予定は、1回目が確変(取り置きは最後の景品)。
 */
async function scene(browser: Browser, request: APIRequestContext, label: string): Promise<Scene> {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toContainText(label);
  await seedJackpot(host.page, { prizes: PRIZES });
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });
  await adminRpc(request, "sessionHub_ensureJackpotPlan", { sessionId, plan: { kakuhenTimings: [1], reservedPrizeIds: [PRIZES[PRIZES.length - 1].id] } });
  const guests = await Promise.all(ids.map((id) => loginByQr(browser, id, keys.get(id)!)));

  await openAdvanced(admin.page);
  await admin.page.getByTestId("event-title").fill("飛ばしの抽選会");
  await admin.page.getByRole("button", { name: "イベントを開始" }).click();
  await expect(admin.page.getByTestId("pool-state")).toContainText("参加者全員(自動)");
  for (const g of guests) await expect(g.page.getByTestId("entry-done")).toContainText("自動でエントリー済み ✓");

  await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
  await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
  return { admin, host, sessionId, guests };
}

const closeAll = async (s: Scene) => {
  for (const d of [s.admin, s.host, ...s.guests]) await d.context.close();
};

/** 管理端末の画面の表示(進行が進むと変わる)。 */
const consoleText = async (admin: Page) =>
  [await admin.getByTestId("now").innerText(), await admin.getByTestId("jackpot-state").innerText(), await admin.getByTestId("next-hint").innerText().catch(() => "")].join("|");

/** 条件を満たすまで、管理端末の「次へ」で進める(jackpot-server-state.spec.ts の stepUntil と同じ。押せるようになってから確かめ、1回押したら画面が変わるのを待つ)。 */
async function stepUntil(admin: Page, done: () => Promise<boolean>, what: string, maxSteps = 120): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    await expect(nextButton(admin)).toBeEnabled({ timeout: 60_000 });
    if (await done()) return;
    const before = await consoleText(admin);
    await nextButton(admin).click();
    await expect.poll(async () => (await consoleText(admin)) !== before, { timeout: 6_000 }).toBe(true).catch(() => undefined);
  }
  throw new Error(`${what}: ${maxSteps} 回進めても満たされない`);
}

const stateText = (admin: Page) => admin.getByTestId("jackpot-state").innerText();
const memberShown = async (admin: Page) => /当選者: 飛ばし\d/.test(await stateText(admin));
const prizeShown = async (admin: Page) => /賞品: 飛ばし景品\d/.test(await stateText(admin));
/** 参加者の結果ページの、ジャックポットのタブを開く(開いたままなら、更新の通知で自動で変わる)。 */
async function openJackpotResults(guest: Device): Promise<void> {
  if (!(await guest.page.getByTestId("results-page").isVisible())) await guest.page.getByRole("link", { name: "結果" }).click();
  await guest.page.getByTestId("results-tab-jackpot").click();
}
const guestOf = (s: Scene, memberId: string) => s.guests[ids.indexOf(memberId)];
const skipButton = (admin: Page) => admin.getByTestId("skip-winner-button");

/** 「この人を飛ばす(不在)」を押して確認し、サーバーで当選者が置き換わる(未公開に戻る)のを待つ。置き換え前の当選者のIDを返す。 */
async function skipCurrentWinner(s: Scene, request: APIRequestContext, drawIndex: number): Promise<{ before: ServerDraw; after: ServerDraw; state: ServerState }> {
  const admin = s.admin.page;
  const { sessionId } = s;
  const before = (await serverState(request, sessionId)).draws[drawIndex];
  await expect(skipButton(admin)).toBeEnabled({ timeout: 60_000 });
  await skipButton(admin).click();
  await expect(admin.getByRole("dialog")).toContainText(`${before.memberName}さんを以降の抽選から外し、同じ景品で引き直します。続けますか?`);
  await acceptConfirm(admin, "飛ばして引き直す");
  await expect
    .poll(async () => (await serverState(request, sessionId)).draws[drawIndex].memberId, { timeout: 60_000 })
    .not.toBe(before.memberId);
  const state = await serverState(request, sessionId);
  return { before, after: state.draws[drawIndex], state };
}

test("(a)(c) 確変の回(メンバー発表後)と通常の回(景品の結果表示中)で飛ばし、最後まで通しても重複は0。景品・確変の回は変わらない", async ({ browser, request }) => {
  test.setTimeout(600_000);
  const s = await scene(browser, request, "飛ばし会場A");
  const admin = s.admin.page;
  const host = s.host;
  const { sessionId } = s;

  // 1回目(確変): 当選者が見えた(メンバー発表後)ところで飛ばす。飛ばせる場面になるまで、ボタンは出ない
  await expect(skipButton(admin)).toHaveCount(0);
  await stepUntil(admin, () => memberShown(admin), "1回目の当選者が見える");
  const first = await skipCurrentWinner(s, request, 0);
  expect(first.before.isKakuhen, "1回目は確変").toBe(true);
  expect(first.after).toMatchObject({ drawId: first.before.drawId, prizeId: first.before.prizeId, isKakuhen: true, revealedAtMs: null });
  expect(first.state.excludedMemberIds).toEqual([first.before.memberId]);
  // 確変の景品は、取り置いた景品のまま
  expect(first.state.plan!.reservedPrizeIds).toContain(first.after.prizeId);
  // 飛ばした直後は、メンバー抽選のやり直し(新しい当選者はまだ見えない)
  await expect.poll(async () => (await stateText(admin)).includes("当選者: —")).toBe(true);

  // 新しい当選者と景品の結果が見えて、公開される。公開された当選者は置き換え後の人
  await stepUntil(admin, async () => (await prizeShown(admin)) && (await revealedCount(request, sessionId)) === 1, "景品が見えて、置き換え後の当選者が公開される");
  expect((await serverState(request, sessionId)).draws[0]).toMatchObject({ drawId: first.before.drawId, memberId: first.after.memberId });

  // 参加者の当選履歴(c): 置き換え後の当選者だけが当選として見える。飛ばした人の画面には当選が出ない
  await openJackpotResults(guestOf(s, first.after.memberId));
  await expect(guestOf(s, first.after.memberId).page.getByTestId("results-draw-mine")).toBeVisible({ timeout: 30_000 });
  await openJackpotResults(guestOf(s, first.before.memberId));
  await expect(guestOf(s, first.before.memberId).page.getByTestId("results-draw-mine")).toHaveCount(0);

  // 2回目(通常): 景品の結果が見えている間に飛ばす
  // (1回目の公開のあと、2回目は裏で先に確定される。画面に2回目の当選者と景品が見えるまで進める)
  await stepUntil(
    admin,
    async () => {
      const second = (await serverState(request, sessionId)).draws[1];
      return !!second && (await stateText(admin)).includes(`当選者: ${second.memberName}`) && (await prizeShown(admin));
    },
    "2回目の景品の結果が見える"
  );
  const secondBefore = (await serverState(request, sessionId)).draws[1];
  expect(secondBefore.revealedAtMs, "景品の結果が見えているので公開済み").not.toBeNull();
  await openJackpotResults(guestOf(s, secondBefore.memberId));
  await expect(guestOf(s, secondBefore.memberId).page.getByTestId("results-draw-mine")).toBeVisible({ timeout: 30_000 });
  const second = await skipCurrentWinner(s, request, 1);
  expect(second.before.isKakuhen, "2回目は通常").toBe(false);
  expect(second.after).toMatchObject({ drawId: second.before.drawId, prizeId: second.before.prizeId, isKakuhen: false, revealedAtMs: null });
  expect(second.state.excludedMemberIds).toEqual([first.before.memberId, second.before.memberId]);
  // 参加者の当選履歴(c): 飛ばした時点で、2回目の当選は一度消える(新しい当選者を見せ終えるまで見えない)
  await expect(guestOf(s, second.before.memberId).page.getByTestId("results-draw-mine")).toHaveCount(0, { timeout: 30_000 });

  // 最後まで通す: 対象は 5 人 - 飛ばした 2 人 = 3 人。3 回で終わる
  await stepUntil(admin, async () => host.page.getByTestId("end-dialog").isVisible().catch(() => false), "終了の画面が出る", 200);
  const state = await serverState(request, sessionId);
  expect(state.draws, "当選は3回(飛ばした2人は当選しない)").toHaveLength(3);
  expect(new Set(state.draws.map((d) => d.memberId)).size, "同じ人が二度当選していない").toBe(3);
  expect(new Set(state.draws.map((d) => d.prizeId)).size, "同じ景品が二度出ていない").toBe(3);
  for (const excluded of state.excludedMemberIds) expect(state.draws.map((d) => d.memberId), "飛ばした人は当選しない").not.toContain(excluded);
  expect(state.draws.every((d) => d.revealedAtMs !== null)).toBe(true);
  expect(state.draws.map((d) => d.isKakuhen)).toEqual([true, false, false]);
  await expect(host.page.getByTestId("end-dialog")).toHaveAttribute("data-reason", "members");
  await expect(host.page.getByTestId("end-message")).toHaveText("対象の 3 名全員の抽選が終わりました。");
  await closeAll(s);
});

test("(b) 飛ばしたあと、公開する前にホストを再読み込みしても、置き換え後の抽選は公開済みになり、最後の1件(先読み分)を演出し直す。飛ばした人は戻らない", async ({ browser, request }) => {
  test.setTimeout(420_000);
  const s = await scene(browser, request, "飛ばし会場B");
  const admin = s.admin.page;
  const host = s.host;
  const { sessionId } = s;

  await stepUntil(admin, () => memberShown(admin), "当選者が見える");
  const { before, after } = await skipCurrentWinner(s, request, 0);
  expect(after.revealedAtMs).toBeNull();
  // 先読みで確定済みの次の抽選(未公開)が、飛ばしたあとも残っている(捨てない)
  await expect.poll(async () => (await serverState(request, sessionId)).draws.length, { timeout: 60_000 }).toBe(2);
  const next = (await serverState(request, sessionId)).draws[1];
  expect(next.revealedAtMs).toBeNull();

  await host.page.reload();
  await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
  await expect(admin.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });

  // 古い分(置き換え後の1件目)は公開済み。最後の1件(先読み分)が演出し直される。引き直されていない(同じ抽選・景品)
  await expect.poll(async () => (await serverState(request, sessionId)).draws[0].revealedAtMs, { timeout: 30_000 }).not.toBeNull();
  await stepUntil(admin, async () => (await stateText(admin)).includes(`当選者: ${next.memberName}`), "先読み分の当選者が見える(再読み込み後)");
  expect(await stateText(admin)).not.toContain(before.memberName);
  await stepUntil(admin, async () => (await revealedCount(request, sessionId)) === 2, "景品が見えて公開される");
  const state = await serverState(request, sessionId);
  expect(state.excludedMemberIds).toEqual([before.memberId]);
  expect(state.draws[0]).toMatchObject({ drawId: before.drawId, memberId: after.memberId, prizeId: before.prizeId });
  expect(state.draws[1]).toMatchObject({ drawId: next.drawId, memberId: next.memberId, prizeId: next.prizeId });

  // 最後まで通しても、飛ばした人は当選しない。重複は0
  await stepUntil(admin, async () => host.page.getByTestId("end-dialog").isVisible().catch(() => false), "終了の画面が出る", 200);
  const done = await serverState(request, sessionId);
  expect(done.draws, "対象は 5 人 - 飛ばした 1 人 = 4 人").toHaveLength(4);
  expect(new Set(done.draws.map((d) => d.memberId)).size).toBe(4);
  expect(done.draws.map((d) => d.memberId)).not.toContain(before.memberId);
  await closeAll(s);
});
