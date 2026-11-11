import { expect, newDevice, seedStore, test } from "./fixtures";

/**
 * デモ・最終結果の画面設定の項目。使っていない項目(デモSE2・最終結果SE1/SE2)は無く、デモSE1 は「デモ抽選SE」になっている。
 * 古い版(版1)の記録に古い項目が残っていても、開くと整理され、画面には新しい項目だけが出る。
 */
test.describe("ジャックポットの画面設定の項目", () => {
  test("デモは BGM と抽選SE だけ、最終結果は BGM だけ。版1の古い項目は整理される", async ({ browser }) => {
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await page.goto("/#/execute/jackpot-admin/screens/demo");
    const legacy = {
      schemaVersion: 1,
      prizes: [],
      screens: [
        { screenName: "demo", settingName: "demo-screen-settings", settingValue: JSON.stringify({ demoBgm: "", demoSe1: "", demoSe2: "" }) },
        { screenName: "result", settingName: "result-screen-settings", settingValue: JSON.stringify({ resultBgm: "", resultSe1: "", resultSe2: "" }) },
      ],
      media: {},
    };
    await seedStore(page, "jackpot-game", "JackpotData", [{ id: "record", value: { data: legacy, updatedAt: Date.now() } }]);

    await page.goto("/#/execute/jackpot-admin/screens/demo");
    await page.reload();
    await expect(page.getByRole("heading", { name: "デモ抽選画面設定" })).toBeVisible();
    await expect(page.getByText("デモBGM", { exact: true })).toBeVisible();
    await expect(page.getByText("デモ抽選SE", { exact: true })).toBeVisible();
    await expect(page.getByText("デモSE1", { exact: true })).toHaveCount(0);
    await expect(page.getByText("デモSE2", { exact: true })).toHaveCount(0);

    await page.goto("/#/execute/jackpot-admin/screens/result");
    await expect(page.getByRole("heading", { name: "最終結果画面設定" })).toBeVisible();
    await expect(page.getByText("最終結果BGM", { exact: true })).toBeVisible();
    await expect(page.getByText("最終結果SE1", { exact: true })).toHaveCount(0);
    await expect(page.getByText("最終結果SE2", { exact: true })).toHaveCount(0);
    await dev.context.close();
  });
});
