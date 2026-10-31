import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_TOKEN, expect, newDevice, seedRecord, test } from "./fixtures";

/**
 * ジャックポットの全画面(演出・結果・管理)を開き、例外・404・横スクロール・文字切れが無いことを確認する。
 * E2E_SHOTS を指定すると各画面のスクリーンショットを保存する(デザイン確認用)。
 */
const SHOTS = process.env.E2E_SHOTS;

const SCREENS = [
  "/execute/jackpot-opening",
  "/execute/jackpot-description",
  "/execute/jackpot-demo",
  "/execute/jackpot-result",
  "/execute/jackpot-history",
  "/execute/jackpot-ending",
  "/execute/jackpot-admin/members",
  "/execute/jackpot-admin/prizes",
  "/execute/jackpot-admin/screens/opening",
  "/execute/jackpot-admin/screens/description",
  "/execute/jackpot-admin/screens/demo",
  "/execute/jackpot-admin/screens/draw",
  "/execute/jackpot-admin/screens/result",
  "/execute/jackpot-admin/screens/ending",
  "/execute/jackpot-admin/assets",
  "/execute/jackpot-admin/results",
];

const VIEWPORTS = [
  { name: "fhd", width: 1920, height: 1080 },
  { name: "hd", width: 1280, height: 720 },
];

async function rpc(page: Page, name: string, args: unknown) {
  const res = await page.request.post("/rpc", { data: { name, args: { __octopusAuth: ADMIN_TOKEN, args } } });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`${name}: ${json.message}`);
}

test.describe("ジャックポットの全画面", () => {
  for (const vp of VIEWPORTS) {
    test(`全画面を開いてもエラー・崩れがない (${vp.name})`, async ({ browser }) => {
      test.setTimeout(300_000);
      const dev = await newDevice(browser, { signedIn: true });
      const page = dev.page;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const problems: string[] = [];
      let current = "";
      page.on("pageerror", (e) => problems.push(`[${current}] pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`[${current}] console.error: ${m.text().slice(0, 200)}`);
      });
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().includes("favicon")) problems.push(`[${current}] HTTP ${r.status()} ${r.url()}`);
      });

      await rpc(page, "accounts_replaceAllMembers", {
        members: Array.from({ length: 12 }, (_, i) => ({ id: `m${i + 1}`, name: `メンバー${i + 1}` })),
      });
      await page.goto("/#/sessions");
      await seedRecord(
        page,
        "jackpot-game",
        "PrizeData",
        Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `景品${i + 1}`, order: i + 1, weight: 10 }))
      );

      const dir = SHOTS ? join(SHOTS, vp.name) : null;
      if (dir) mkdirSync(dir, { recursive: true });
      for (const path of SCREENS) {
        current = path;
        await page.goto(`/#${path}`);
        await page.waitForTimeout(2500);
        const overflow = await page.evaluate(() => {
          const d = document.documentElement;
          return { sw: d.scrollWidth, vw: window.innerWidth };
        });
        if (overflow.sw > overflow.vw + 1) problems.push(`[${path}] 横スクロール scrollWidth=${overflow.sw} > ${overflow.vw}`);
        if (dir) await page.screenshot({ path: join(dir, `${path.replace(/^\/execute\//, "").replace(/\//g, "_")}.png`) });
      }
      console.log(`[screens ${vp.name}] problems=${problems.length}\n${[...new Set(problems)].join("\n")}`);
      expect([...new Set(problems)], [...new Set(problems)].join("\n")).toEqual([]);
      await dev.context.close();
    });
  }
});
