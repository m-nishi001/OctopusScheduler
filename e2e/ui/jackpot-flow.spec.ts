import type { Page } from "@playwright/test";
import { ADMIN_TOKEN, createSession, expect, newDevice, route, test } from "./fixtures";

/**
 * ジャックポットの本抽選を、ホスト(投影)・管理・参加者の3端末で通しで動かす。
 * 実際の抽選画面(ルーレット/スロット)をホストで動かし、管理端末の「次へ」で進め、
 * 参加者のスマホには当選者が停止演出の後に表示されることを確認する。
 */

/** 管理者としてメンバーを登録する(参加者名簿。抽選の対象になる)。 */
async function addMembers(page: Page, names: string[]): Promise<void> {
  for (const [i, name] of names.entries()) {
    const res = await page.request.post("/rpc", {
      data: { name: "accounts_addMember", args: { __octopusAuth: ADMIN_TOKEN, args: { id: `m${i + 1}`, name } } },
    });
    const json = await res.json();
    if (json.status !== "success" && !/already exists/.test(json.message ?? "")) throw new Error(json.message);
  }
}

/** ローカルDB(IndexedDB)に賞品を直接入れる。アプリが localforage で読む形式({data, updatedAt})。 */
async function seedPrizes(page: Page, prizes: Array<{ id: string; name: string; order: number; weight?: number }>): Promise<void> {
  await page.evaluate(async (items) => {
    const open = (version?: number, upgrade?: (db: IDBDatabase) => void) =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = version === undefined ? indexedDB.open("jackpot-game") : indexedDB.open("jackpot-game", version);
        req.onupgradeneeded = () => upgrade?.(req.result);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    let db = await open();
    if (!db.objectStoreNames.contains("PrizeData")) {
      const next = db.version + 1;
      db.close();
      db = await open(next, (d) => {
        if (!d.objectStoreNames.contains("PrizeData")) d.createObjectStore("PrizeData");
      });
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("PrizeData", "readwrite");
      const store = tx.objectStore("PrizeData");
      for (const p of items) store.put({ data: p, updatedAt: Date.now() }, p.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, prizes);
}

test.describe("ジャックポットの遠隔進行", () => {
  test("管理端末の「次へ」で抽選が進み、当選者は停止演出の後に参加者へ表示される", async ({ browser }) => {
    test.setTimeout(180_000);
    const adminDev = await newDevice(browser, { signedIn: true });
    await addMembers(adminDev.page, ["太郎", "花子", "次郎", "三郎", "四郎", "五郎"]);
    const { id, code } = await createSession(adminDev.page, "抽選会場");

    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss()); // 想定外の alert で止まらないように
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();
    await seedPrizes(host.page, [
      { id: "p1", name: "特賞", order: 1, weight: 10 },
      { id: "p2", name: "一等", order: 2, weight: 10 },
      { id: "p3", name: "二等", order: 3, weight: 10 },
      { id: "p4", name: "三等", order: 4, weight: 10 },
      { id: "p5", name: "四等", order: 5, weight: 10 },
    ]);

    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto(`/#/portal/${code}`);
    await expect(phone.page.locator(".portal__session")).toBeVisible();

    // 管理端末から本抽選の画面を開く
    await adminDev.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(adminDev.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
    // まだ当選者は公開されない
    await expect(phone.page.getByTestId("winner")).toBeHidden();

    // 「次へ」を押して進める。ルーレットを止められる場面では参加者のスマホに停止ボタンが出る。
    let phoneStopped = false;
    for (let i = 0; i < 30; i++) {
      const state = await adminDev.page.getByTestId("jackpot-state").innerText();
      if (/当選者: (太郎|花子|次郎|三郎|四郎|五郎)/.test(state)) break;
      const stopBtn = phone.page.getByRole("button", { name: "ルーレットを止める" });
      if (!phoneStopped && (await stopBtn.isVisible().catch(() => false))) {
        await stopBtn.click(); // 参加者がスマホで止める
        phoneStopped = true;
      } else {
        await adminDev.page.getByRole("button", { name: /次へ/ }).click();
      }
      await adminDev.page.waitForTimeout(1500);
    }
    await expect(adminDev.page.getByTestId("jackpot-state")).toContainText(/当選者: (太郎|花子|次郎|三郎|四郎|五郎)/, { timeout: 60_000 });
    await expect(phone.page.getByTestId("winner")).toContainText(/当選者: (太郎|花子|次郎|三郎|四郎|五郎)/);
    expect(phoneStopped).toBe(true);

    for (const d of [adminDev, host, phone]) await d.context.close();
  });
});
