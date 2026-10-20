import type { Page } from "@playwright/test";
import { expect, newDevice, test } from "./fixtures";

/** 設定の「イベント」タブ: 予定イベントを追加・編集・削除でき、再読み込みしても残る。 */

async function openEvents(page: Page) {
  await page.goto("/#/settings?tab=events");
  await expect(page.getByRole("button", { name: "追加", exact: true })).toBeVisible();
}

async function addEvent(page: Page, typeLabel: string) {
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page.getByRole("button", { name: typeLabel }).click();
}

const row = (page: Page, typeLabel: string) => page.getByRole("row").filter({ hasText: typeLabel });

/** 削除の確認ダイアログの「削除」(行の削除ボタンと同じ名前なので、ダイアログの中に絞る)。 */
const confirmDelete = (page: Page) => page.getByRole("contentinfo").getByRole("button", { name: "削除" }).click();

test.describe("予定イベント(設定 > イベント)", () => {
  test("どの種類の追加画面も、開始・終了の初期値(開始〜1分後)つきで開く", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    await openEvents(page);
    for (const label of ["コンテンツ表示イベント", "音楽再生イベント", "スライドショーイベント", "画面遷移イベント", "音楽停止イベント"]) {
      await addEvent(page, label);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const [start, end] = await dialog.locator('input[type="datetime-local"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
      expect(start, label).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect((new Date(end).getTime() - new Date(start).getTime()) / 60_000, label).toBe(1);
      await dialog.getByRole("button", { name: "キャンセル" }).click();
      await expect(dialog).toBeHidden();
    }
    await d.context.close();
  });

  test("画面遷移と音楽停止を追加すると一覧に並び、再読み込みしても残る。編集で中身と時刻が保たれ、削除できる", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    await openEvents(page);
    await expect(page.getByText("イベントがありません。")).toBeVisible();

    // 画面遷移を追加
    await addEvent(page, "画面遷移イベント");
    await page.locator("#startTime").fill("2030-03-01T10:00");
    await page.locator("#endTime").fill("2030-03-01T11:30");
    await page.locator("#transitionUrl").fill("/quiz-admin");
    await page.locator("#fadeOutDuration").fill("2");
    await page.getByRole("button", { name: "追加", exact: true }).last().click();
    await expect(row(page, "画面遷移")).toHaveCount(1);

    // 音楽停止を追加
    await addEvent(page, "音楽停止イベント");
    await page.locator("#startTime").fill("2030-03-01T12:00");
    await page.locator("#endTime").fill("2030-03-01T12:05");
    await page.getByRole("button", { name: "追加", exact: true }).last().click();
    await expect(row(page, "音楽停止")).toHaveCount(1);

    // 再読み込みしても残り、保存した値がそのまま編集画面に出る(日時が9時間ずれない)
    await page.reload();
    await expect(row(page, "画面遷移")).toHaveCount(1);
    await expect(row(page, "音楽停止")).toHaveCount(1);
    await row(page, "画面遷移").getByRole("button", { name: "編集" }).click();
    await expect(page.locator("#startTime")).toHaveValue("2030-03-01T10:00");
    await expect(page.locator("#endTime")).toHaveValue("2030-03-01T11:30");
    await expect(page.locator("#transitionUrl")).toHaveValue("/quiz-admin");
    await expect(page.locator("#fadeOutDuration")).toHaveValue("2");

    // 編集して更新: 1件のまま、URL だけ変わる
    await page.locator("#transitionUrl").fill("/jackpot-admin");
    await page.getByRole("button", { name: "更新", exact: true }).click();
    await expect(row(page, "画面遷移")).toHaveCount(1);
    await page.reload();
    await row(page, "画面遷移").getByRole("button", { name: "編集" }).click();
    await expect(page.locator("#transitionUrl")).toHaveValue("/jackpot-admin");
    await expect(page.locator("#startTime")).toHaveValue("2030-03-01T10:00");
    await page.getByRole("button", { name: "キャンセル" }).click();

    // 削除
    await row(page, "音楽停止").getByRole("button", { name: "削除" }).click();
    await confirmDelete(page);
    await expect(row(page, "音楽停止")).toHaveCount(0);
    await row(page, "画面遷移").getByRole("button", { name: "削除" }).click();
    await confirmDelete(page);
    await expect(page.getByText("イベントがありません。")).toBeVisible();
    await d.context.close();
  });
});
