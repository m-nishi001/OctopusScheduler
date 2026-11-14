import { expect, newDevice, seedJackpot, test, type Device } from "./fixtures";

/** 画面設定が空の状態から始める(ほかのテストが同期したサーバーの設定を読まないように、新しい空の設定を入れる)。 */
async function cleanStart(dev: Device, path: string) {
  await dev.page.goto("/#/sessions");
  await seedJackpot(dev.page, { demoDraw: true });
  await dev.page.goto(`/#${path}`);
  await dev.page.reload();
}

/**
 * 管理画面の「画面設定」フォーム(デモ抽選・説明・オープニング)。
 * - デモ抽選: ON/OFF(既定 ON)・回数(1〜3、既定 1)・BGM。旧「デモBGM」「抽選SE」は無い。
 * - 説明: 画像かテキストのページだけ。効果・秒数・効果音の欄は無い(1ページずつ手で送る)。
 * - オープニング/エンディング: 種類は テキスト / 画像(HTML は無い)。効果は 流れる / 行送り / フェード / 静止。秒数は秒。行送りでだけ行数が出る。
 */
test.describe("ジャックポットの画面設定フォーム", () => {
  test("デモ抽選: 設定が無いときは ON・1回。OFF・回数を保存でき、開き直しても残る。旧項目(デモBGM・抽選SE)は無い", async ({ browser }) => {
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await cleanStart(dev, "/execute/jackpot-admin/screens/demo");
    await expect(page.getByRole("heading", { name: "デモ抽選画面設定" })).toBeVisible();
    await expect(page.getByTestId("demo-enabled")).toBeChecked();
    await expect(page.getByTestId("demo-rounds")).toHaveValue("1");
    await expect(page.getByText("デモBGM", { exact: true })).toHaveCount(0);
    await expect(page.getByText("デモ抽選SE", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/結果は記録も公開もしません/)).toBeVisible();

    await page.getByTestId("demo-rounds").selectOption("3");
    await page.getByTestId("demo-enabled").uncheck();
    await expect(page.getByTestId("demo-rounds")).toBeDisabled(); // OFF の間は回数を変えられない
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("demo-enabled")).not.toBeChecked();
    await expect(page.getByTestId("demo-rounds")).toHaveValue("3");

    // 元に戻す(ほかのテストに影響しないよう、既定の ON・1回)
    await page.getByTestId("demo-enabled").check();
    await page.getByTestId("demo-rounds").selectOption("1");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    await dev.context.close();
  });

  test("説明: ページの種類は 画像 / テキストだけで、効果・秒数・効果音の欄は無い。ページを足して保存でき、開き直しても残る", async ({ browser }) => {
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await cleanStart(dev, "/execute/jackpot-admin/screens/description");
    await expect(page.getByRole("heading", { name: "説明画面設定" })).toBeVisible();
    await expect(page.getByTestId("editor-hint")).toContainText("1ページずつ");

    await page.getByRole("button", { name: "追加", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("entry-kind").locator("option")).toHaveText(["画像", "テキスト"]);
    await expect(dialog.getByTestId("entry-effect")).toHaveCount(0);
    await expect(dialog.getByTestId("entry-seconds")).toHaveCount(0);
    await expect(dialog.getByText("効果音")).toHaveCount(0);
    await dialog.getByTestId("entry-text").fill("ルールの説明\n1人ずつ回します");
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(page.getByTestId("entry-row")).toHaveCount(1);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("entry-row")).toHaveCount(1);
    await expect(page.getByTestId("entry-row")).toContainText("ルールの説明");

    // 後始末: ページを削除して保存
    await page.getByTestId("entry-row").getByRole("button", { name: "削除" }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    await dev.context.close();
  });

  test("オープニング: 種類は テキスト / 画像(HTML は無い)。効果は4つで、行送りを選んだときだけ行数が出る。秒数は秒", async ({ browser }) => {
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await cleanStart(dev, "/execute/jackpot-admin/screens/opening");
    await expect(page.getByRole("heading", { name: "オープニング画面設定" })).toBeVisible();

    await page.getByRole("button", { name: "追加", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("entry-kind").locator("option")).toHaveText(["テキスト", "画像"]);
    await expect(dialog.getByTestId("entry-effect").locator("option")).toHaveText(["流れる", "行送り", "フェード", "静止"]);
    await expect(dialog.getByText("秒数(秒)")).toBeVisible();
    await expect(dialog.getByTestId("entry-lines")).toHaveCount(0);
    await dialog.getByTestId("entry-effect").selectOption("行送り");
    await expect(dialog.getByTestId("entry-lines")).toHaveValue("3"); // 既定は 3 行
    await expect(dialog.getByTestId("effect-hint")).toContainText("秒数おきに上へ送ります");

    // 画像にすると、行送りは選べない(静止になる)
    await dialog.getByTestId("entry-kind").selectOption("画像");
    await expect(dialog.getByTestId("entry-effect")).toHaveValue("静止");
    await expect(dialog.getByTestId("entry-effect").locator("option")).toHaveText(["流れる", "フェード", "静止"]);
    await dev.context.close();
  });
});
