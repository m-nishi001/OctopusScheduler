import { expect, newDevice, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** クイズ管理 > クイズ一覧: 選んだ正解は、選択肢を追加しても、保存して再読み込みしても変わらない。 */

async function addOption(page: Page, text: string) {
  await page.getByRole("button", { name: "選択肢を追加" }).click();
  const optionDialog = page.getByRole("dialog", { name: "選択肢追加" });
  await optionDialog.getByRole("textbox").first().fill(text);
  await optionDialog.getByRole("button", { name: "保存" }).click();
  await expect(optionDialog).toBeHidden();
}

test.describe("クイズ管理の正解", () => {
  test("新規クイズで正解を2にし、選択肢を追加して保存すると、再読み込みしても2のまま", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    const title = `e2e正解-${Date.now()}`;
    await page.goto("/#/quiz-admin");
    await page.getByRole("button", { name: "新規クイズ追加" }).click();
    const dialog = page.getByRole("dialog", { name: "クイズ追加" });
    await dialog.locator("input[type=text]").first().fill(title);
    await dialog.locator("textarea").fill("正解はどれ?");

    await addOption(page, "A");
    await addOption(page, "B");
    const correct = dialog.locator("select");
    await correct.selectOption({ label: "2: B" });
    await expect(correct).toHaveValue("2");

    // 選択肢を足しても正解は2のまま(以前は1に戻った)
    await addOption(page, "C");
    await expect(correct).toHaveValue("2");
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    const row = page.getByRole("row").filter({ hasText: title });
    await row.getByRole("button", { name: "編集" }).click();
    const edit = page.getByRole("dialog", { name: "クイズ編集" });
    await expect(edit.locator("select")).toHaveValue("2");
    await expect(edit.locator("select option:checked")).toHaveText("2: B");

    // 編集中に別の選択肢を足して正解を3にし、キャンセルすると保存済みの2のまま
    await addOption(page, "D");
    await edit.locator("select").selectOption({ label: "3: C" });
    await edit.getByRole("button", { name: "キャンセル" }).click();
    await expect(edit).toBeHidden();
    await row.getByRole("button", { name: "編集" }).click();
    const again = page.getByRole("dialog", { name: "クイズ編集" });
    await expect(again.locator("select")).toHaveValue("2");
    await expect(again.locator("select option")).toHaveCount(3);
    await d.context.close();
  });
});
