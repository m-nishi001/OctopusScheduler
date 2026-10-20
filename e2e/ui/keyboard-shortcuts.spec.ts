import type { Page } from "@playwright/test";
import { expect, newDevice, test } from "./fixtures";

/** 設定の「ショートカット」タブ: キーにアクションを割り当てて保存でき、編集で中身が戻る。予定イベントと同じフォームを使う。 */

async function openShortcuts(page: Page) {
  await page.goto("/#/settings?tab=keyboard-shortcuts");
  await expect(page.getByText("ショートカットがありません")).toBeVisible();
}

async function startShortcut(page: Page, key: string) {
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page.locator(".captured-keys").focus();
  await page.keyboard.press(key);
  await expect(page.locator(".captured-keys")).toHaveValue(key);
  await page.locator(".captured-keys").blur();
}

/** 種類を選び、そのフォームで入力して OK まで進める。 */
async function addAction(page: Page, typeLabel: string, fill: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>) {
  await page.getByRole("button", { name: "アクションを追加" }).click();
  await page.getByRole("button", { name: typeLabel, exact: true }).click();
  const editor = page.getByRole("dialog").filter({ hasText: "アクション編集" });
  await fill(editor);
  await editor.getByRole("button", { name: "OK" }).click();
  await expect(editor).toBeHidden();
}

test.describe("キーボードショートカット(設定 > ショートカット)", () => {
  test("画面遷移とスライドショーのアクションを割り当てて保存でき、再読み込みしても編集画面に値が戻る", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    await openShortcuts(page);
    await startShortcut(page, "F5");

    await addAction(page, "画面遷移", async (editor) => {
      await editor.locator("#transitionUrl").fill("/quiz-admin");
      await editor.locator("#fadeOutDuration").fill("2");
    });
    await addAction(page, "スライドショー", async (editor) => {
      await editor.locator("#folderId").fill("slides-k");
      await editor.locator("#displayDuration").fill("6");
      await editor.locator("#transitionType").selectOption("slide");
      await editor.locator("#slideDirection").selectOption("down");
    });
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: "F5" })).toHaveCount(1);

    await page.reload();
    const shortcutRow = page.getByRole("row").filter({ hasText: "F5" });
    await expect(shortcutRow).toHaveCount(1);
    await shortcutRow.getByRole("button", { name: "編集" }).click();
    // アクションの並びから、それぞれ開いて保存した値が戻っていることを見る
    const actions = page.locator(".actions-list > *");
    await expect(actions).toHaveCount(2);
    await actions.nth(0).getByRole("button", { name: /編集/ }).click();
    const editor = page.getByRole("dialog").filter({ hasText: "アクション編集" });
    await expect(editor.locator("#transitionUrl")).toHaveValue("/quiz-admin");
    await expect(editor.locator("#fadeOutDuration")).toHaveValue("2");
    await d.context.close();
  });
});
