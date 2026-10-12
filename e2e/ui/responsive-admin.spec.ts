import { expect, newDevice, test } from "./fixtures";
import { expectNoHorizontalOverflow, VIEWPORTS } from "./helpers/responsive";

/** 管理系の主要画面が、スマホ/タブレット/PC の幅で横にはみ出さないこと。 */
const SCREENS: Array<{ name: string; hash: string }> = [
  { name: "ホーム", hash: "/home" },
  { name: "設定", hash: "/settings" },
  { name: "セッション一覧", hash: "/sessions" },
  { name: "ジャックポット管理", hash: "/jackpot-admin" },
  { name: "クイズ管理", hash: "/quiz-admin" },
  { name: "ジャックポット抽選結果", hash: "/jackpot-admin/results" },
  { name: "ジャックポット景品", hash: "/jackpot-admin/prizes" },
  { name: "ジャックポットアセット", hash: "/jackpot-admin/assets" },
];

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const screen of SCREENS) {
    test(`@smoke 管理画面 ${screen.name} は ${vpName} 幅ではみ出さない`, async ({ browser }) => {
      const d = await newDevice(browser, { signedIn: true });
      await d.page.setViewportSize(viewport);
      await d.page.goto(`/#${screen.hash}`);
      await d.page.waitForLoadState("networkidle");
      // ログイン画面などに飛ばされて「何も見ていない」状態で通らないよう、管理画面に居ることを確認する
      await expect(d.page).not.toHaveURL(/#\/login/);
      await expect(d.page.locator("h1, h2, [role=tab], button").first()).toBeVisible();
      await expectNoHorizontalOverflow(d.page, `${screen.name}/${vpName}`);
      await d.context.close();
    });
  }
}
