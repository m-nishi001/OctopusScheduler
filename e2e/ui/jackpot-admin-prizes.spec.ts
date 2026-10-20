import { expect, newDevice, test } from "./fixtures";

/** ジャックポット管理 > 景品: 追加・編集のフォーム(画像4つ・BGM2つの素材欄)が、保存して再読み込みしても戻る。 */

/** 1x1 の PNG。 */
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

test.describe("ジャックポット管理の景品", () => {
  test("画像を選んで景品を追加でき、再読み込みしても残る。編集画面では、その画像が既存の素材として選ばれている", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    // 景品が最初から入っている環境(staging の架空データ)でも通るよう、名前を一意にして、その行だけを見る
    const name = `e2e賞-${Date.now()}`;
    await page.goto("/#/jackpot-admin");
    await page.getByRole("tab", { name: "景品" }).click();
    const row = () => page.getByRole("row").filter({ hasText: name });

    await page.getByRole("button", { name: "追加", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("景品名").fill(name);
    // 画像の欄は初期が「アップロード」。画像1にだけ選び、当選画像2にも選ぶ
    const fileInputs = dialog.locator('input[type="file"]');
    await expect(fileInputs).toHaveCount(4);
    await fileInputs.nth(0).setInputFiles({ name: "main.png", mimeType: "image/png", buffer: PNG_1X1 });
    await fileInputs.nth(3).setInputFiles({ name: "win2.png", mimeType: "image/png", buffer: PNG_1X1 });
    await expect(dialog.getByText("main.png")).toBeVisible();
    await expect(dialog.locator("img.preview-img-small")).toHaveCount(2);
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();
    // 画像のある景品は、一覧に画像(選んだ2枚)が出て、無い欄は「なし」の表示になる
    await expect(row().locator("img.preview-img")).toHaveCount(2);
    await expect(row().getByText("画像2なし")).toBeVisible();

    await page.reload();
    await page.getByRole("tab", { name: "景品" }).click();
    await expect(row().locator("img.preview-img")).toHaveCount(2);
    await row().getByRole("button", { name: "詳細" }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByPlaceholder("景品名")).toHaveValue(name);
    // 保存済みの画像は「既存から選択」になり、選んだ素材のプレビューが出る。選んでいない欄は「アップロード」のまま
    await expect(edit.locator('input[type="radio"][value="select"]:checked')).toHaveCount(2);
    // 空の欄は「アップロード」(画像2つ + BGM2つ)
    await expect(edit.locator('input[type="file"]')).toHaveCount(4);
    await expect(edit.locator("img.preview-img-small")).toHaveCount(2);
    await d.context.close();
  });
});
