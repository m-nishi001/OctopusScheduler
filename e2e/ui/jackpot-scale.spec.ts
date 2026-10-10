import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_TOKEN, expect, newDevice, seedStore, test } from "./fixtures";

/**
 * 人数・景品数を変えてホストの抽選画面を最後まで進め、例外・レイアウト崩れが出ないことを確認する。
 * Enter キー(ホスト単体の「次へ」)で進める。各段階でスクリーンショットを E2E_SHOTS に保存する。
 */
const SHOTS = process.env.E2E_SHOTS;

const rpc = async (page: Page, name: string, args: unknown) => {
  const res = await page.request.post("/rpc", { data: { name, args: { __octopusAuth: ADMIN_TOKEN, args } } });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`${name}: ${json.message}`);
  return json.data;
};

async function resetMembers(page: Page, names: string[]): Promise<void> {
  await rpc(page, "accounts_replaceAllMembers", {
    members: names.map((name, i) => ({ id: `m${i + 1}`, name })),
  });
}

/** 画面内の要素がビューポートからはみ出していないか(アニメ用の意図的な画面外要素は除く)を調べる。 */
async function overflowReport(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    if (doc.scrollWidth > vw + 1) out.push(`横スクロール発生 scrollWidth=${doc.scrollWidth} > ${vw}`);
    if (doc.scrollHeight > vh + 1) out.push(`縦スクロール発生 scrollHeight=${doc.scrollHeight} > ${vh}`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("dialog, [role=dialog], .dialog, [class*=dialog]"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
        out.push(`ダイアログはみ出し ${el.className} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] vp=${vw}x${vh}`);
      }
    }
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,p,span,div,button"))) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim();
      if (!text) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== "visible" && cs.textOverflow !== "ellipsis") {
        out.push(`文字切れ <${el.tagName.toLowerCase()} class="${el.className}"> "${text.slice(0, 20)}"`);
      }
    }
    return out;
  });
}

const SCENARIOS: Array<{ members: number; prizes: number; viewport: { width: number; height: number }; maxDraws?: number }> = [
  { members: 1, prizes: 1, viewport: { width: 1920, height: 1080 } },
  { members: 2, prizes: 3, viewport: { width: 1920, height: 1080 } },
  { members: 3, prizes: 2, viewport: { width: 1920, height: 1080 } },
  { members: 10, prizes: 10, viewport: { width: 1280, height: 720 }, maxDraws: 3 },
  // 全100回の演出を進めると長すぎるため、先頭の数回だけ実画面で確認する(全回の整合はユニットのマトリクスで検証)
  { members: 300, prizes: 100, viewport: { width: 1920, height: 1080 }, maxDraws: 3 },
];

test.describe("ジャックポットの規模別・通し(ホスト単体)", () => {
  for (const sc of SCENARIOS) {
    test(`メンバー${sc.members}人 × 景品${sc.prizes}件 (${sc.viewport.width}x${sc.viewport.height})`, async ({ browser }) => {
      test.setTimeout(600_000);
      const dev = await newDevice(browser, { signedIn: true, projector: true });
      const page = dev.page;
      await page.setViewportSize(sc.viewport);
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`console.error: ${m.text().slice(0, 300)}`);
      });
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().includes("favicon")) problems.push(`HTTP ${r.status()} ${r.url()}`);
      });
      page.on("dialog", (d) => {
        problems.push(`alert: ${d.message()}`);
        void d.dismiss();
      });

      await resetMembers(page, Array.from({ length: sc.members }, (_, i) => `メンバー${i + 1}`));
      await page.goto("/#/sessions");
      await seedStore(
        page,
        "jackpot-game",
        "PrizeData",
        Array.from({ length: sc.prizes }, (_, i) => ({
          id: `p${i + 1}`,
          value: { id: `p${i + 1}`, name: `景品${i + 1}`, order: i + 1, weight: 10 },
        }))
      );
      await page.goto("/#/execute/jackpot-draw");
      await page.reload();

      const dir = SHOTS ? join(SHOTS, `m${sc.members}-p${sc.prizes}-${sc.viewport.width}`) : null;
      if (dir) mkdirSync(dir, { recursive: true });
      const draws = Math.min(sc.members, sc.prizes, sc.maxDraws ?? Infinity);
      const maxSteps = draws * 40 + 20;
      const layout = new Set<string>();
      let shot = 0;
      let finished = false;
      let prizeNamesSeen = 0;
      await page.waitForTimeout(2000);
      for (let step = 0; step < maxSteps && !finished; step++) {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(sc.members * sc.prizes > 5000 ? 1500 : 900);
        for (const l of await overflowReport(page)) layout.add(l);
        if (dir && step % 3 === 0) await page.screenshot({ path: join(dir, `${String(shot++).padStart(3, "0")}.png`) });
        // 賞品ダイアログには必ず賞品名が出ている(画像なしの賞品でも何が当たったか分かる)
        if (await page.getByText("景品当選").isVisible().catch(() => false)) {
          const name = await page.getByTestId("prize-winning-name").innerText().catch(() => "");
          if (!/^景品\d+$/.test(name.trim())) layout.add(`景品当選ダイアログに賞品名が出ていない: "${name}"`);
          else prizeNamesSeen++;
        }
        finished =
          (await page.getByText("すべての景品が皆さんの手元にいきました").isVisible().catch(() => false)) ||
          (sc.maxDraws !== undefined && prizeNamesSeen >= sc.maxDraws * 2);
      }
      if (dir) await page.screenshot({ path: join(dir, "final.png") });

      const summary = [...new Set(problems)].concat([...layout]);
      console.log(`[scale ${sc.members}x${sc.prizes}] problems=${summary.length}\n${summary.join("\n")}`);
      expect(summary, summary.join("\n")).toEqual([]);
      await dev.context.close();
    });
  }
});
