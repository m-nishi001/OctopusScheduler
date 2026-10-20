import { expect, newDevice, test } from "./fixtures";

/**
 * 本抽選画面設定の「確変の起こし方」と、メンバーの「当選しやすさ」が、管理画面から設定でき、保存されること。
 * 設定が実際の抽選に効くことは、単体テスト（draw-full-run.spec.ts / member-draw-service.spec.ts）で確かめている。
 */
test.describe("ジャックポットの管理画面の設定", () => {
  test("確変の起こし方を「回を指定する」にして保存でき、開き直しても残る。「おまかせ」に戻すと回の入力欄は隠れる", async ({ browser }) => {
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await page.goto("/#/execute/jackpot-admin/screens/draw");

    const mode = page.getByTestId("kakuhen-mode");
    await expect(mode).toBeVisible();
    await expect(mode).toHaveValue("auto");
    await expect(page.getByTestId("kakuhen-timings")).toBeHidden();

    await mode.selectOption("fixed");
    await page.getByTestId("kakuhen-timings").fill("7, 3, 3");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    // 保存すると、重複を除いて小さい順に整えた表示に戻る
    await expect(page.getByTestId("kakuhen-timings")).toHaveValue("3, 7");

    await page.reload();
    await expect(page.getByTestId("kakuhen-mode")).toHaveValue("fixed");
    await expect(page.getByTestId("kakuhen-timings")).toHaveValue("3, 7");

    await page.getByTestId("kakuhen-mode").selectOption("auto");
    await expect(page.getByTestId("kakuhen-timings")).toBeHidden();
    await dev.context.close();
  });
});
