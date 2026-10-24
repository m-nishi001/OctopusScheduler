import type { APIRequestContext, Page } from "@playwright/test";
import { acceptConfirm, adminRpc, createSession, expect, newDevice, openAdvanced, test } from "./fixtures";

/**
 * エントリー受付: 管理者がイベントを開始してエントリーを受け付け、参加者(10人 + 途中参加)がスマホから
 * エントリーすると、会場の画面(ホスト)にバブルが現れ、運営の一覧にも載る。
 * 参加者は別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは各テストの中で作り、終わったら消す。
 */

const CROWD = 10;
const ids = Array.from({ length: CROWD + 3 }, (_, i) => `en-e2e-${String(i + 1).padStart(2, "0")}`);
const keys = new Map<string, string>();
const sessionIds: string[] = [];

const qrUrl = (id: string) => `/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(keys.get(id)!)}`;
const nameOf = (id: string) => `参加者${id.slice(-2)}`;

test.describe.configure({ mode: "serial" });

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

const publish = (request: APIRequestContext, sessionId: string, published = true) =>
  adminRpc(request, "sessionHub_setPortalSession", { sessionId, published });

/** 管理コンソールの操作（画面のボタン）。 */
async function startEvent(admin: Page, title: string) {
  await openAdvanced(admin);
  await admin.getByTestId("event-title").fill(title);
  await admin.getByRole("button", { name: "イベントを開始" }).click();
  await expect(admin.getByTestId("event-state")).toContainText(title);
  // 既定の対象は「参加者全員(自動)」でエントリーのボタンは出ない。ボタンで参加する形にするため、「エントリーした人のみ」に切り替える
  await admin.getByRole("button", { name: "エントリーした人だけに切り替える" }).click();
  await expect(admin.getByTestId("pool-state")).toContainText("エントリーした人のみ");
}

test.describe("エントリー受付", () => {
  test("10人がエントリーすると会場にバブルが現れ運営の一覧に載る。重複・途中参加・締切・再開に対応", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "エントリー会場");
    sessionIds.push(sessionId);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toContainText("エントリー会場");
    await publish(request, sessionId);

    // 運営: イベントを開始 → エントリー受付を開始 → 会場の画面にバブルのステージを映す
    await startEvent(admin.page, "ジャックポット抽選");
    await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付中");
    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "エントリー受付(バブル)" }).click();
    await expect(host.page).toHaveURL(/#\/event-entry$/);
    await expect(host.page.getByTestId("stage-label")).toHaveText("エントリー受付中!");
    await expect(host.page.getByTestId("stage-title")).toHaveText("ジャックポット抽選");
    await expect(host.page.getByTestId("stage-count")).toHaveText("0");

    // 参加者10人がQRでログイン → バナーに「エントリー受付中!」
    const guests = await Promise.all(ids.slice(0, CROWD).map(() => newDevice(browser, { mobile: true })));
    await Promise.all(guests.map((g, i) => g.page.goto(qrUrl(ids[i]))));
    for (const [i, g] of guests.entries()) {
      await expect(g.page.getByTestId("entry-button"), ids[i]).toContainText("エントリーする");
      await expect(g.page.getByTestId("home-join"), ids[i]).toHaveCount(0);
    }

    // 全員がほぼ同時にエントリーボタンを押す。1タップで、画面を移らずにエントリーが済む
    await Promise.all(guests.map((g) => g.page.getByTestId("entry-button").click()));
    for (const [i, g] of guests.entries()) await expect(g.page.getByTestId("entry-done"), ids[i]).toContainText("エントリー済み ✓");
    for (const g of guests) await expect(g.page).toHaveURL(/#\/p$/);

    // 会場の画面: 10個のバブルに名前、人数10
    await expect(host.page.getByTestId("stage-count")).toHaveText(`${CROWD}`);
    await expect(host.page.getByTestId("entry-bubble")).toHaveCount(CROWD);
    for (const id of ids.slice(0, CROWD)) await expect(host.page.getByTestId("entry-bubbles")).toContainText(nameOf(id));
    // 運営の画面: 人数と一覧
    await expect(admin.page.getByTestId("entry-count")).toHaveText(`${CROWD}`);
    await expect(admin.page.getByTestId("entrants").locator("li")).toHaveCount(CROWD);

    // 重複: リロードしても「済み」、同じメンバーの2台目で押しても人数は増えない
    await guests[0].page.reload();
    await expect(guests[0].page.getByTestId("entry-done")).toBeVisible();
    const second = await newDevice(browser, { mobile: true });
    await second.page.goto(qrUrl(ids[1]));
    await second.page.getByTestId("entry-button").click();
    await expect(second.page.getByTestId("entry-done")).toBeVisible();
    await expect(admin.page.getByTestId("entry-count")).toHaveText(`${CROWD}`);

    // 途中参加: 11人目が受付中に入ってエントリーできる
    const late = await newDevice(browser, { mobile: true });
    await late.page.goto(qrUrl(ids[CROWD]));
    await late.page.getByTestId("entry-button").click();
    await expect(late.page.getByTestId("entry-done")).toContainText("エントリー済み ✓");
    await expect(host.page.getByTestId("stage-count")).toHaveText(`${CROWD + 1}`);
    await expect(host.page.getByTestId("entry-bubble")).toHaveCount(CROWD + 1);

    // 締切: 受付終了の表示。締切後に来た人はエントリーできず、済みの人は結果待ちの案内
    await admin.page.getByRole("button", { name: "エントリーを締め切る" }).click();
    await expect(admin.page.getByTestId("entry-state")).toContainText("エントリー受付は終了");
    await expect(host.page.getByTestId("stage-label")).toHaveText("エントリー受付は終了しました");
    await expect(host.page.getByTestId("entry-bubble")).toHaveCount(CROWD + 1);
    for (const [i, g] of guests.entries()) await expect(g.page.getByTestId("entry-done"), ids[i]).toContainText("受付は終了しました");
    const straggler = await newDevice(browser, { mobile: true });
    await straggler.page.goto(qrUrl(ids[CROWD + 1]));
    // ログインが終わってから(実環境では通信に時間がかかる)、ホームのカードが「受付終了」になっている
    await expect(straggler.page.getByTestId("home-greeting")).toBeVisible();
    await expect(straggler.page.getByTestId("entry-closed")).toContainText("受付終了");
    await expect(straggler.page.getByTestId("entry-button")).toHaveCount(0);

    // 再開: エントリー済みの人を残したまま、取り残された人がエントリーできる
    await admin.page.getByRole("button", { name: "エントリー受付を再開" }).click();
    await expect(straggler.page.getByTestId("entry-button")).toBeVisible();
    await expect(host.page.getByTestId("stage-label")).toHaveText("エントリー受付中!");
    await straggler.page.getByTestId("entry-button").click();
    await expect(straggler.page.getByTestId("entry-done")).toContainText("エントリー済み ✓");
    await expect(host.page.getByTestId("stage-count")).toHaveText(`${CROWD + 2}`);
    await expect(admin.page.getByTestId("entry-count")).toHaveText(`${CROWD + 2}`);

    // イベント終了: エントリーの表示は消える
    await admin.page.getByRole("button", { name: "イベントを終了" }).click();
    await acceptConfirm(admin.page);
    await expect(guests[0].page.getByTestId("home-status")).toContainText("いまイベントは行われていません");

    await publish(request, sessionId, false);
    for (const d of [admin, host, second, late, straggler, ...guests]) await d.context.close();
  });

  test("ホストをリロードしても、受付の状態とエントリー済みの人が保たれ、受付も続けられる", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "リロード会場");
    sessionIds.push(sessionId);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toContainText("リロード会場");
    await publish(request, sessionId);
    await startEvent(admin.page, "乾杯クイズ");
    await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "エントリー受付(バブル)" }).click();
    await expect(host.page).toHaveURL(/#\/event-entry$/);

    const guests = await Promise.all(ids.slice(0, 3).map(() => newDevice(browser, { mobile: true })));
    for (const [i, g] of guests.entries()) {
      await g.page.goto(qrUrl(ids[i]));
      await g.page.getByTestId("entry-button").click();
      await expect(g.page.getByTestId("entry-done")).toBeVisible();
    }
    await expect(host.page.getByTestId("stage-count")).toHaveText("3");

    // 会場のPCをリロード（ステージ画面のまま）
    await host.page.reload();
    await expect(host.page.getByTestId("stage-label")).toHaveText("エントリー受付中!");
    await expect(host.page.getByTestId("stage-title")).toHaveText("乾杯クイズ");
    await expect(host.page.getByTestId("entry-bubble")).toHaveCount(3);
    await expect(host.page.getByTestId("stage-count")).toHaveText("3");

    // リロード後も受付は続いている（新しい人がエントリーできて、会場の画面に増える）
    const next = await newDevice(browser, { mobile: true });
    await next.page.goto(qrUrl(ids[3]));
    await next.page.getByTestId("entry-button").click();
    await expect(next.page.getByTestId("entry-done")).toBeVisible();
    await expect(host.page.getByTestId("entry-bubble")).toHaveCount(4);
    await expect(admin.page.getByTestId("entry-count")).toHaveText("4");

    await publish(request, sessionId, false);
    for (const d of [admin, host, next, ...guests]) await d.context.close();
  });

  test("参加者は運営用の画面に入れず、参加者の端末情報では受付の締切・一覧の取得はできない", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "権限会場");
    sessionIds.push(sessionId);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toContainText("権限会場");
    await publish(request, sessionId);
    await startEvent(admin.page, "権限テスト");
    await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付中");

    const guest = await newDevice(browser, { mobile: true });
    await guest.page.goto(qrUrl(ids[0]));
    await expect(guest.page.getByTestId("portal-conn")).toContainText("接続中");

    // 参加者の端末では、会場用の画面（運営用）に入れない
    await guest.page.goto("/#/event-entry");
    await expect(guest.page.getByTestId("home-greeting")).toBeVisible();
    await expect(guest.page).toHaveURL(/#\/p$/);

    // 参加者の端末情報（deviceId / token）を使っても、締切・一覧の取得は拒否される
    const creds = await guest.page.evaluate(() => JSON.parse(localStorage.getItem("octopus.session.client") ?? "null") as { sessionId: string; deviceId: string; token: string } | null);
    expect(creds).not.toBeNull();
    const roundKey = await adminRoundKey(request, sessionId);
    for (const name of ["sessionHub_closeRound", "sessionHub_getAnswers"]) {
      const res = await guest.page.request.post("/rpc", { data: { name, args: { ...creds, key: roundKey } } });
      const body = await res.text();
      expect(body, name).toContain("FORBIDDEN");
    }
    // 受付は閉じられていない（参加者は引き続きエントリーできる）
    await expect(guest.page.getByTestId("entry-button")).toBeVisible();

    await publish(request, sessionId, false);
    await admin.context.close();
    await host.context.close();
    await guest.context.close();
  });
});

/** 受付中のラウンドの key（イベントの id から決まる）。管理者の端末の状態から取り出す。 */
async function adminRoundKey(request: APIRequestContext, sessionId: string): Promise<string> {
  const op = await adminRpc<{ deviceId: string; token: string }>(request, "sessionHub_joinOperator", { sessionId, role: "admin", label: "E2E" });
  const poll = await adminRpc<{ state: { data: { event?: { entry?: { key: string } } } } | null }>(request, "sessionHub_poll", {
    sessionId,
    deviceId: op.deviceId,
    token: op.token,
    sinceSeq: 0,
    stateVersion: 0,
  });
  const key = poll.state?.data.event?.entry?.key;
  if (!key) throw new Error("受付中のラウンドの key を取得できませんでした");
  return key;
}
