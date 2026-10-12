import { expect, newDevice, test } from "./fixtures";

/** 管理系の画面の入口(ホーム)と、タブの状態がURLに残ること。 */
test.describe("管理画面の導線", () => {
  test("@smoke ホームは「進行」と「準備・管理」に分かれ、行き止まりの画面へは出ない", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    await d.page.goto("/#/home");
    await expect(d.page.getByTestId("home-run")).toContainText("イベントを開催・進行する");
    await expect(d.page.getByRole("button", { name: /実行画面/ })).toHaveCount(0);

    await d.page.getByTestId("home-run").click();
    await expect(d.page).toHaveURL(/#\/sessions$/);
    await d.page.goBack();
    await d.page.getByTestId("home-quiz").click();
    await expect(d.page).toHaveURL(/quiz-admin/);
    await d.page.goto("/#/home");
    await d.page.getByTestId("home-jackpot").click();
    await expect(d.page).toHaveURL(/jackpot-admin/);
    await d.page.goto("/#/home");
    await d.page.getByTestId("home-settings").click();
    await expect(d.page).toHaveURL(/settings/);
    await d.context.close();
  });

  test("@smoke 設定のタブはURLに残り、再読み込みしても同じタブに戻る", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    await d.page.goto("/#/settings");
    await d.page.getByRole("tab", { name: "メンバー" }).click();
    await expect(d.page).toHaveURL(/tab=members/);
    await d.page.reload();
    await expect(d.page.getByRole("tab", { name: "メンバー" })).toHaveAttribute("aria-selected", "true");
    await d.context.close();
  });

  test("@smoke ジャックポット管理を開くと、最初のタブ(メンバー)が選ばれている", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    await d.page.goto("/#/jackpot-admin");
    const tabs = d.page.getByRole("tab");
    await expect(tabs.first()).toHaveText("メンバー");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await d.context.close();
  });
});
