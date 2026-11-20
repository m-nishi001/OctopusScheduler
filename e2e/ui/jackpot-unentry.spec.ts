import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { acceptConfirm, adminRpc, createSession, expect, loginByQr, newDevice, nextButton, openAdvanced, route, seedJackpot, test, type Device } from "./fixtures";

/**
 * エントリーの取り消し(管理コンソールのエントリー一覧の「外す」)。抽選の対象が「エントリーした人のみ」のとき、間違ったエントリーを外す。
 *   (a) 外すと、運営の一覧・人数から消え、本人のスマホには「エントリーする」が(取り消された知らせつきで)もう一度出る。
 *       本人は受付中ならもう一度エントリーでき、運営の一覧にまた載る。
 *   (b) 外した人は、以降の抽選に出ない(最後まで通して、当選するのは残りの人だけ)。
 *   (c) 当選済みの人は外せない: 一覧には「当選済み」と出てボタンが無く、サーバーも取り消しを拒否する。
 * 参加者は別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは終わったら消す。
 */

const ids = Array.from({ length: 3 }, (_, i) => `jp-unentry-${i + 1}`);
const nameOf = (id: string) => `取消${id.slice(-1)}`;
const keys = new Map<string, string>();
const sessionIds: string[] = [];
const PRIZES = Array.from({ length: 8 }, (_, i) => ({ id: `jp-unentry-p${i + 1}`, name: `取消景品${i + 1}`, order: i + 1, rank: 3 }));

interface ServerState {
  draws: Array<{ memberId: string; revealedAtMs: number | null }>;
}
const serverState = (request: APIRequestContext, sessionId: string) => adminRpc<ServerState>(request, "sessionHub_getJackpotState", { sessionId });

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

/** 管理・ホスト(投影)を開き、対象を「エントリーした人のみ」にして受付を始め、3人の参加者が全員エントリーした場面。 */
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

  await openAdvanced(admin.page);
  await admin.page.getByTestId("event-title").fill("取り消しの抽選会");
  await admin.page.getByRole("button", { name: "イベントを開始" }).click();
  await expect(admin.page.getByTestId("event-state")).toContainText("取り消しの抽選会");
  await admin.page.getByRole("button", { name: "エントリーした人だけに切り替える" }).click();
  await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人のみ");
  await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
  await expect(admin.page.getByTestId("entry-state")).toContainText("受付中");

  const guests = await Promise.all(ids.map((id) => loginByQr(browser, id, keys.get(id)!)));
  for (const g of guests) {
    await g.page.getByTestId("entry-button").click();
    await expect(g.page.getByTestId("entry-done")).toContainText("エントリー済み ✓");
  }
  await expect(admin.page.getByTestId("entry-count")).toHaveText("3");
  return { admin, host, sessionId, guests };
}

const closeAll = async (s: Scene) => {
  for (const d of [s.admin, s.host, ...s.guests]) await d.context.close();
};

/** 運営の一覧の、その人の行。 */
const rowOf = (admin: Page, name: string) => admin.getByTestId("entrants").locator("li", { hasText: name });

/** 「外す」を押して、確認で了承する。 */
async function remove(admin: Page, name: string): Promise<void> {
  await rowOf(admin, name).getByTestId("entrant-remove").click();
  await expect(admin.getByRole("dialog")).toContainText(`${name}さんのエントリーを取り消します`);
  await acceptConfirm(admin, "削除");
}

/** 管理コンソールの表示(進行が進むと変わる)。 */
const consoleText = async (admin: Page) =>
  [await admin.getByTestId("now").innerText(), await admin.getByTestId("jackpot-state").innerText(), await admin.getByTestId("next-hint").innerText().catch(() => "")].join("|");

/** 条件を満たすまで、管理端末の「次へ」で進める(jackpot-server-state.spec.ts の stepUntil と同じ)。 */
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

test("(a) 取り消すと一覧から消え、本人のスマホに「エントリーする」が(取り消された知らせつきで)出る。もう一度エントリーできる", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const s = await scene(browser, request, "取消会場A");
  const admin = s.admin.page;
  const target = ids[0];
  const guest = s.guests[0].page;
  const other = s.guests[1].page;

  // 全員の行に「外す」がある
  await expect(admin.getByTestId("entrant-remove")).toHaveCount(3);
  // やめたら何も変わらない
  await rowOf(admin, nameOf(target)).getByTestId("entrant-remove").click();
  await admin.getByRole("button", { name: "キャンセル" }).click();
  await expect(admin.getByTestId("entry-count")).toHaveText("3");

  await remove(admin, nameOf(target));
  await expect(admin.getByTestId("entry-count")).toHaveText("2");
  await expect(rowOf(admin, nameOf(target))).toHaveCount(0);
  await expect(admin.getByTestId("pool-state")).toContainText("エントリーした人のみ(2人)");
  // 本人のスマホ: 「済み」が外れ、もう一度エントリーできる。取り消された知らせが出る。ほかの人には影響しない
  await expect(guest.getByTestId("entry-button")).toBeVisible({ timeout: 30_000 });
  await expect(guest.getByTestId("entry-cancelled")).toContainText("エントリーが取り消されました");
  await expect(guest.getByTestId("entry-done")).toHaveCount(0);
  await expect(other.getByTestId("entry-done")).toContainText("エントリー済み ✓");
  // リロードしても、取り消された状態のまま(端末に残した「済み」が古いものとして無効になる)
  await guest.reload();
  await expect(guest.getByTestId("entry-button")).toBeVisible({ timeout: 30_000 });

  // もう一度エントリーできる。運営の一覧にまた載る
  await guest.getByTestId("entry-button").click();
  await expect(guest.getByTestId("entry-done")).toContainText("エントリー済み ✓");
  await expect(guest.getByTestId("entry-cancelled")).toHaveCount(0);
  await expect(admin.getByTestId("entry-count")).toHaveText("3");
  await expect(rowOf(admin, nameOf(target))).toHaveCount(1);
  await closeAll(s);
});

test("(b)(c) 取り消した人は以降の抽選に出ない。当選済みの人は外せない(一覧は「当選済み」、サーバーも拒否)", async ({ browser, request }) => {
  test.setTimeout(480_000);
  const s = await scene(browser, request, "取消会場B");
  const { host, sessionId } = s;
  const admin = s.admin.page;
  const removed = ids[0];

  await remove(admin, nameOf(removed));
  await expect(admin.getByTestId("entry-count")).toHaveText("2");
  await admin.getByRole("button", { name: "エントリーを締め切る" }).click();
  await expect(admin.getByTestId("entry-state")).toContainText("エントリー受付は終了");

  await openAdvanced(admin);
  await admin.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
  await expect(admin.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });

  // 1回目が公開されたら、その当選者の行は「当選済み」で、外すボタンが無い。サーバーも取り消しを拒否する
  await stepUntil(admin, async () => (await serverState(request, sessionId)).draws.some((d) => d.revealedAtMs !== null), "1回目の抽選が公開される");
  const first = (await serverState(request, sessionId)).draws[0];
  expect(first.memberId).not.toBe(removed);
  const winnerName = nameOf(first.memberId);
  await expect(rowOf(admin, winnerName).getByTestId("entrant-won")).toHaveText("当選済み", { timeout: 30_000 });
  await expect(rowOf(admin, winnerName).getByTestId("entrant-remove")).toHaveCount(0);
  const creds = await adminRpc<{ deviceId: string; token: string }>(request, "sessionHub_joinOperator", { sessionId, role: "admin", label: "E2E 管理", deviceId: `e2e-unentry-${sessionId}` });
  // 運営の端末の poll には、いまの回答ラウンド(エントリー受付)の key が入る
  const { round } = await adminRpc<{ round: { key: string } }>(request, "sessionHub_poll", { sessionId, ...creds, sinceSeq: 0, stateVersion: -1 });
  await expect(
    adminRpc(request, "sessionHub_removeAnswer", { sessionId, ...creds, key: round.key, memberId: first.memberId })
  ).rejects.toThrow(/JACKPOT_CONFLICT/);
  // 取り消せていない(一覧に残っている)
  const answers = await adminRpc<{ answers: Array<{ memberId: string }> }>(request, "sessionHub_getAnswers", { sessionId, ...creds, key: round.key });
  expect(answers.answers.map((a) => a.memberId)).toContain(first.memberId);

  // 最後まで通す: 対象は取り消していない 2 人。取り消した人は一度も当選しない
  await stepUntil(admin, async () => host.page.getByTestId("end-dialog").isVisible().catch(() => false), "終了の画面が出る", 200);
  const state = await serverState(request, sessionId);
  const winners = state.draws.map((d) => d.memberId);
  expect(winners, "当選は取り消していない 2 人").toHaveLength(2);
  expect(new Set(winners).size, "同じ人が二度当選していない").toBe(2);
  expect(winners, "取り消した人は当選しない").not.toContain(removed);
  await expect(host.page.getByTestId("end-message")).toHaveText("対象の 2 名全員の抽選が終わりました。");
  await closeAll(s);
});
