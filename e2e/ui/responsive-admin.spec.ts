import { expect, newDevice, test } from "./fixtures";
import { expectNoHorizontalOverflow, VIEWPORTS } from "./helpers/responsive";

/**
 * 管理系の主要画面が、スマホ/タブレット/PC の幅で横にはみ出さないこと。
 * シード済みの環境(E2E_SEEDED=1 で `npm run dev:stack` に向ける)では、データの入った状態で同じ確認をする
 * (抽選結果・景品・クイズが並ぶ表のはみ出しは、空データでは見つからない)。
 */
const SCREENS: Array<{ name: string; hash: string }> = [
  { name: "ホーム", hash: "/home" },
  { name: "設定", hash: "/settings" },
  { name: "セッション一覧", hash: "/sessions" },
  { name: "ジャックポット管理(メンバー)", hash: "/jackpot-admin" },
  { name: "ジャックポット景品", hash: "/jackpot-admin/prizes" },
  { name: "ジャックポット抽選結果", hash: "/jackpot-admin/results" },
  { name: "画面設定(オープニング)", hash: "/jackpot-admin/screens/opening" },
  { name: "画面設定(説明)", hash: "/jackpot-admin/screens/description" },
  { name: "画面設定(デモ抽選)", hash: "/jackpot-admin/screens/demo" },
  { name: "画面設定(本抽選)", hash: "/jackpot-admin/screens/draw" },
  { name: "画面設定(最終結果)", hash: "/jackpot-admin/screens/result" },
  { name: "画面設定(エンディング)", hash: "/jackpot-admin/screens/ending" },
  { name: "クイズ管理", hash: "/quiz-admin" },
  { name: "クイズのメンバー", hash: "/quiz-admin/members" },
];

const seeded = !!process.env.E2E_SEEDED;

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const screen of SCREENS) {
    test(`@smoke 管理画面 ${screen.name} は ${vpName} 幅ではみ出さない`, async ({ browser }) => {
      test.setTimeout(seeded ? 120_000 : 60_000);
      const d = await newDevice(browser, { signedIn: true });
      await d.page.setViewportSize(viewport);
      await d.page.goto(`/#${screen.hash}`);
      await d.page.waitForLoadState("networkidle");
      // シード済みの環境では、Drive/R2 からの取り込みが終わって表に行が並ぶのを待つ
      if (seeded) await d.page.waitForTimeout(6_000);
      // ログイン画面などに飛ばされて「何も見ていない」状態で通らないよう、管理画面に居ることを確認する
      await expect(d.page).not.toHaveURL(/#\/login/);
      await expect(d.page.locator("h1, h2, [role=tab], button").first()).toBeVisible();
      await expectNoHorizontalOverflow(d.page, `${screen.name}/${vpName}`);
      await d.context.close();
    });
  }
}
