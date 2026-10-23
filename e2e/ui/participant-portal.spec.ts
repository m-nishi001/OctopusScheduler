import type { APIRequestContext, Page } from "@playwright/test";
import { acceptConfirm, adminRpc, createSession, expect, newDevice, openAdvanced, test } from "./fixtures";

/**
 * 参加者ポータル: 管理者が公開したセッションに、ログイン済みの参加者が参加コード無しで入り、
 * イベントの開始/終了が全員の画面に届く。参加者は10人(別々のブラウザコンテキスト = 別々のスマホ)。
 * 参加者・セッションは各テストの中で作り、終わったら消す(他のテストに影響しない)。
 */

const CROWD = 10;
const ids = Array.from({ length: CROWD + 1 }, (_, i) => `pp-e2e-${String(i + 1).padStart(2, "0")}`);
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

async function publish(request: APIRequestContext, sessionId: string, published = true) {
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published });
}

/** 管理者がコンソールでイベントを開始する(画面の操作)。 */
async function startEvent(admin: Page, title: string) {
  await openAdvanced(admin);
  await admin.getByTestId("event-title").fill(title);
  await admin.getByRole("button", { name: /^イベントを(開始|切り替える)$/ }).click();
}

test.describe("参加者ポータル", () => {
  test("10人が受付QRで入り、イベントの開始・終了が全員に届く。途中参加・ホストのリロードにも対応", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "ポータル会場");
    sessionIds.push(sessionId);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toContainText("ポータル会場");
    await publish(request, sessionId);

    // 受付で10人が一斉にQRを読み取る
    const guests = await Promise.all(ids.slice(0, CROWD).map(() => newDevice(browser, { mobile: true })));
    await Promise.all(guests.map((g, i) => g.page.goto(qrUrl(ids[i]))));
    for (const [i, g] of guests.entries()) {
      await expect(g.page.getByTestId("home-greeting"), ids[i]).toContainText(`${nameOf(ids[i])} さん`);
      await expect(g.page.getByTestId("portal-conn"), ids[i]).toContainText("接続中");
      await expect(g.page.getByTestId("home-status"), ids[i]).toContainText("いまイベントは行われていません");
      await expect(g.page.getByTestId("event-banner"), ids[i]).toHaveCount(0);
    }
    // 運営の画面に、入室した参加者が数えられる
    await expect(admin.page.getByTestId("host-card")).toContainText(`参加者 ${CROWD} 人`);
    await expect(admin.page.getByTestId("event-state")).toContainText("イベントは開催していません");

    // イベント開始 → 全員の画面の上に「イベント発生中!」
    await startEvent(admin.page, "ジャックポット抽選");
    await expect(admin.page.getByTestId("event-state")).toContainText("ジャックポット抽選");
    for (const [i, g] of guests.entries()) {
      await expect(g.page.getByTestId("home-status"), ids[i]).toContainText("イベント発生中!");
      await expect(g.page.getByTestId("home-event-title"), ids[i]).toContainText("ジャックポット抽選");
      // 抽選の対象は既定で参加者全員(自動)なので、受付が無くても「自動でエントリー済み」。「参加する」のようなリンクは無い
      await expect(g.page.getByTestId("entry-done"), ids[i]).toContainText("自動でエントリー済み ✓");
      await expect(g.page.getByTestId("home-join"), ids[i]).toHaveCount(0);
    }

    // イベントタブを開くとイベント画面(同じカード)。ほかの画面にいる人には、上部のバナーが出ている
    await guests[0].page.getByRole("link", { name: "イベント" }).click();
    await expect(guests[0].page).toHaveURL(/#\/p\/event$/);
    await expect(guests[0].page.getByTestId("event-title")).toHaveText("ジャックポット抽選");
    await expect(guests[0].page.getByTestId("event-banner")).toHaveCount(0);
    await guests[1].page.getByRole("link", { name: "マイページ" }).click();
    await expect(guests[1].page.getByTestId("me-name")).toHaveText(nameOf(ids[1]));
    await expect(guests[1].page.getByTestId("event-banner")).toContainText("ジャックポット抽選");

    // 途中参加: イベント中に11人目が入ると、最初からバナーが出ている
    const late = await newDevice(browser, { mobile: true });
    await late.page.goto(qrUrl(ids[CROWD]));
    await expect(late.page.getByTestId("home-greeting")).toContainText(`${nameOf(ids[CROWD])} さん`);
    await expect(late.page.getByTestId("home-event-title")).toContainText("ジャックポット抽選");

    // ホストをリロードしても、発生中のイベントは保たれる(あとから入った人にも出る)
    await host.page.reload();
    await expect(host.page.locator(".host-view__title")).toContainText("ポータル会場");
    const afterReload = await newDevice(browser, { mobile: true });
    await afterReload.page.goto(qrUrl(ids[2]));
    await expect(afterReload.page.getByTestId("home-event-title")).toContainText("ジャックポット抽選");

    // イベントを切り替えると全員のタイトルが変わる
    await startEvent(admin.page, "乾杯クイズ");
    for (const [i, g] of guests.entries()) await expect(g.page.getByTestId("home-event-title").or(g.page.getByTestId("event-title")).or(g.page.getByTestId("event-banner")), ids[i]).toContainText("乾杯クイズ");

    // イベント終了 → 全員のバナーが消え、イベント画面は終了の案内に変わる
    await admin.page.getByRole("button", { name: "イベントを終了" }).click();
    await acceptConfirm(admin.page);
    await expect(admin.page.getByTestId("event-state")).toContainText("イベントは開催していません");
    for (const [i, g] of guests.entries()) await expect(g.page.getByTestId("event-banner"), ids[i]).toHaveCount(0);
    await expect(guests[1].page.getByTestId("entry-none")).toHaveCount(0);
    await expect(guests[0].page.getByTestId("event-none")).toContainText("いまイベントは行われていません");
    await expect(late.page.getByTestId("event-banner")).toHaveCount(0);
    await expect(late.page.getByTestId("home-event-title")).toHaveCount(0);

    // 後続のテストに公開を残さない
    await publish(request, sessionId, false);
    for (const d of [admin, host, late, afterReload, ...guests]) await d.context.close();
  });

  test("公開中のセッションが無いと待機の表示。管理画面で公開すると、つなぎ直して入れる", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId, name } = await createSession(admin.page, "公開テスト会場");
    sessionIds.push(sessionId);

    const guest = await newDevice(browser, { mobile: true });
    await guest.page.goto(qrUrl(ids[0]));
    await expect(guest.page.getByTestId("home-greeting")).toContainText(nameOf(ids[0]));
    await expect(guest.page.getByTestId("portal-conn")).toContainText("イベント待ち");
    await expect(guest.page.getByTestId("home-status")).toContainText("参加できるイベントはありません");

    // 管理画面の一覧で「ポータルに公開」を押す
    await admin.page.goto("/#/sessions");
    const row = admin.page.locator("tbody tr", { hasText: name });
    await expect(row.getByTestId("portal-on")).toHaveCount(0);
    await row.getByRole("button", { name: "ポータルに公開" }).click();
    await expect(row.getByTestId("portal-on")).toBeVisible();

    await guest.page.getByTestId("home-retry").click();
    await expect(guest.page.getByTestId("portal-conn")).toContainText("接続中");

    // 公開を止めると、新しく入る人は待機になる
    await row.getByRole("button", { name: "ポータル公開を止める" }).click();
    await expect(row.getByTestId("portal-on")).toHaveCount(0);
    const other = await newDevice(browser, { mobile: true });
    await other.page.goto(qrUrl(ids[1]));
    await expect(other.page.getByTestId("portal-conn")).toContainText("イベント待ち");

    await publish(request, sessionId, false);
    for (const d of [admin, guest, other]) await d.context.close();
  });

  test("セッションを終了すると参加者の画面は終了の案内になり、公開中のセッションが無くなる", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "終了テスト会場");
    sessionIds.push(sessionId);
    await publish(request, sessionId);

    const guest = await newDevice(browser, { mobile: true });
    await guest.page.goto(qrUrl(ids[0]));
    await expect(guest.page.getByTestId("portal-conn")).toContainText("接続中");

    await adminRpc(request, "sessionHub_closeSession", { sessionId });
    await expect(guest.page.getByTestId("portal-conn")).toContainText("イベント待ち");
    await expect(guest.page.getByTestId("home-status")).toContainText("参加できるイベントはありません");
    await admin.context.close();
    await guest.context.close();
  });

  test("参加者のログインでは、ポータルの公開・セッション作成・終了などの管理操作はできない", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "権限テスト会場");
    sessionIds.push(sessionId);
    await publish(request, sessionId);

    const guest = await newDevice(browser, { mobile: true });
    await guest.page.goto(qrUrl(ids[0]));
    await expect(guest.page.getByTestId("portal-conn")).toContainText("接続中");
    const token = await guest.page.evaluate(() => localStorage.getItem("octopus-session-token"));
    for (const name of ["sessionHub_setPortalSession", "sessionHub_closeSession", "sessionHub_listSessions", "sessionHub_createSession"]) {
      const res = await guest.page.request.post("/rpc", { data: { name, args: { __octopusAuth: token, args: { sessionId, published: false, name: "x" } } } });
      expect(await res.text(), name).toContain("Unauthorized");
    }
    // 公開は変わっていない
    await admin.page.goto("/#/sessions");
    await expect(admin.page.locator("tbody tr", { hasText: "権限テスト会場" }).getByTestId("portal-on")).toBeVisible();
    await publish(request, sessionId, false);
    await admin.context.close();
    await guest.context.close();
  });
});
