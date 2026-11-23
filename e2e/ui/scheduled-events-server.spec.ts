import type { Page } from "@playwright/test";
import { adminRpc, expect, newDevice, resetScheduleEvents, scheduleEventsOnServer, test } from "./fixtures";

/**
 * 予定イベントの正はサーバー(全端末で共有)。端末の IndexedDB は、最後に取得した内容の読み取り用キャッシュ。
 * - 別の端末(別のブラウザコンテキスト)にも、同じイベントと実行状態が見える。
 * - サーバーの予定イベントの取得が失敗しても、キャッシュで一覧が出る。
 */

const openEvents = async (page: Page) => {
  await page.goto("/#/settings?tab=events");
  await expect(page.getByRole("button", { name: "追加", exact: true })).toBeVisible();
};

const row = (page: Page, typeLabel: string) => page.getByRole("row").filter({ hasText: typeLabel });

/** この端末が持つキャッシュ(`ScheduleEventsRecord` ストアの1件)の中身。 */
const cachedRecord = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ events: { id: string }[]; status: Record<string, string> } | null>((resolve, reject) => {
        const open = indexedDB.open("octopus-scheduler");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("ScheduleEventsRecord")) return resolve(null);
          const get = db.transaction("ScheduleEventsRecord").objectStore("ScheduleEventsRecord").get("record");
          get.onerror = () => reject(get.error);
          get.onsuccess = () => resolve(get.result?.data ?? null);
        };
      })
  );

async function addPageEvent(page: Page, url: string) {
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page.getByRole("button", { name: "画面遷移イベント" }).click();
  await page.locator("#startTime").fill("2030-03-01T10:00");
  await page.locator("#endTime").fill("2030-03-01T11:00");
  await page.locator("#transitionUrl").fill(url);
  await page.getByRole("button", { name: "追加", exact: true }).last().click();
  await expect(row(page, "画面遷移")).toHaveCount(1);
}

test.describe("予定イベントのサーバー保存", () => {
  test.beforeEach(({ request }) => resetScheduleEvents(request));
  test.afterEach(({ request }) => resetScheduleEvents(request));

  test("別の端末にも、同じイベントと実行状態が見える。編集しても実行状態は残る", async ({ browser, request }) => {
    const a = await newDevice(browser, { signedIn: true });
    const b = await newDevice(browser, { signedIn: true });
    await openEvents(a.page);
    await openEvents(b.page);
    await expect(b.page.getByText("イベントがありません。")).toBeVisible();

    // A で作ったイベントが、B に(タブに戻ったときの取り直しで)出る
    await addPageEvent(a.page, "/quiz-admin");
    await b.page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(row(b.page, "画面遷移")).toHaveCount(1);

    // 再生側の状態遷移(実行中)。サーバーと、B のキャッシュに実行状態が出る
    const { events } = await scheduleEventsOnServer(request);
    expect(events).toHaveLength(1);
    const id = events[0].id;
    await adminRpc(request, "octopusScheduler_markScheduleEvents", { ids: [id], status: "running" });
    expect((await scheduleEventsOnServer(request)).status).toEqual({ [id]: "running" });
    await b.page.reload();
    await expect(row(b.page, "画面遷移")).toHaveCount(1);
    await expect.poll(async () => (await cachedRecord(b.page))?.status).toEqual({ [id]: "running" });

    // B で編集しても、A から見て実行状態は残り、編集は A に出る
    await row(b.page, "画面遷移").getByRole("button", { name: "編集" }).click();
    await b.page.locator("#transitionUrl").fill("/jackpot-admin");
    await b.page.getByRole("button", { name: "更新", exact: true }).click();
    await expect(b.page.getByRole("dialog")).toBeHidden();
    expect((await scheduleEventsOnServer(request)).status).toEqual({ [id]: "running" });
    await a.page.reload();
    await row(a.page, "画面遷移").getByRole("button", { name: "編集" }).click();
    await expect(a.page.locator("#transitionUrl")).toHaveValue("/jackpot-admin");
    await a.page.getByRole("button", { name: "キャンセル" }).click();

    // A で消すと、実行状態ごと消え、B にも出なくなる
    await row(a.page, "画面遷移").getByRole("button", { name: "削除" }).click();
    await a.page.getByRole("contentinfo").getByRole("button", { name: "削除" }).click();
    await expect(a.page.getByText("イベントがありません。")).toBeVisible();
    await b.page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(b.page.getByText("イベントがありません。")).toBeVisible();
    expect(await scheduleEventsOnServer(request)).toMatchObject({ events: [], status: {} });
    await a.context.close();
    await b.context.close();
  });

  test("サーバーから取れなくても、最後に取得したキャッシュで一覧が出る(再読み込みしても)", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    await openEvents(page);
    await addPageEvent(page, "/quiz-admin");
    await expect.poll(async () => (await cachedRecord(page))?.events.length).toBe(1);

    // 予定イベントの取得だけを失敗させる(通信が切れた状態)
    let blocked = 0;
    await page.route("**/rpc", async (route) => {
      const name = route.request().postDataJSON()?.name;
      if (name === "octopusScheduler_getScheduleEvents") {
        blocked++;
        return route.abort("internetdisconnected");
      }
      return route.continue();
    });
    await page.reload();
    await expect(row(page, "画面遷移")).toHaveCount(1);
    expect(blocked).toBeGreaterThan(0);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(row(page, "画面遷移")).toHaveCount(1);
    await d.context.close();
  });
});
