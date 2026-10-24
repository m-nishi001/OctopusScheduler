import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SWEEP_SIZES } from "./responsive";

/**
 * 景品抽選のスロット(.slot-container)を画面の見た目から確かめるヘルパー。
 * 大きさ(遠くから読めるか)・窓に見える景品の並び(同じ景品が続けて見えないか)・はみ出しを DOM の実測で見る。
 */

/** スロット全体の高さが、画面の高さに占める割合と、景品の文字の大きさ(px)。 */
export async function slotMetrics(page: Page) {
  return page.evaluate(() => {
    const slot = document.querySelector<HTMLElement>(".slot-container")!;
    const rect = slot.getBoundingClientRect();
    const item = slot.querySelector<HTMLElement>(".prize-item")!;
    return {
      heightRatio: rect.height / window.innerHeight,
      widthRatio: rect.width / window.innerWidth,
      font: Number.parseFloat(getComputedStyle(item).fontSize),
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
}

/** スロットが画面いっぱいに近い大きさで、文字が大きい(遠くからでも読める)こと。 */
export async function expectSlotLarge(page: Page, label: string, min: { heightRatio: number; font: number }) {
  const m = await slotMetrics(page);
  expect(m.heightRatio, `${label}: スロットが画面の高さの ${min.heightRatio * 100}% 以上を使う(実測 ${(m.heightRatio * 100).toFixed(0)}%)`).toBeGreaterThanOrEqual(min.heightRatio);
  expect(m.font, `${label}: 景品の文字が ${min.font}px 以上(実測 ${m.font}px)`).toBeGreaterThanOrEqual(min.font);
  expectSlotInside(m, label);
}

function expectSlotInside(m: Awaited<ReturnType<typeof slotMetrics>>, label: string) {
  const { rect, viewport } = m;
  const where = `${label} ${viewport.width}x${viewport.height} [${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)}]`;
  expect(rect.left, `${where}: 左にはみ出す`).toBeGreaterThanOrEqual(-1);
  expect(rect.top, `${where}: 上にはみ出す`).toBeGreaterThanOrEqual(-1);
  expect(rect.right, `${where}: 右にはみ出す`).toBeLessThanOrEqual(viewport.width + 1);
  expect(rect.bottom, `${where}: 下にはみ出す`).toBeLessThanOrEqual(viewport.height + 1);
}

/** どの窓の大きさ(4:3・16:9・縦長・小さい端末)でも、スロットが画面に収まる。終わったら元の大きさに戻す。 */
export async function expectSlotFitsEverySize(page: Page, label: string) {
  const original = page.viewportSize();
  const sizes = [...SWEEP_SIZES, { width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 800, height: 1200 }];
  try {
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expectSlotInside(await slotMetrics(page), label);
    }
  } finally {
    if (original) await page.setViewportSize(original);
  }
}

/**
 * 回っている間、毎フレームの窓(各リールの3マス)に見える景品の名前を集め、同じ名前が上下に続いて見えたものを返す。
 * 窓の中だけでなく、窓から1マス外(次に見える景品)との並びも見る。
 */
export async function sampleRepeatedRows(page: Page, frames: number): Promise<string[]> {
  return page.evaluate(async (count) => {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      document.querySelectorAll<HTMLElement>(".slot-container .reel").forEach((reel, r) => {
        const box = reel.getBoundingClientRect();
        const names = Array.from(reel.querySelectorAll<HTMLElement>(".prize-item"))
          .filter((row) => {
            const b = row.getBoundingClientRect();
            return b.bottom > box.top - 2 && b.top < box.bottom + 2;
          })
          .map((row) => row.textContent?.trim() ?? "");
        for (let k = 1; k < names.length; k++) if (names[k] === names[k - 1]) out.push(`frame ${i} reel ${r}: "${names[k]}" が続けて見える`);
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return out;
  }, frames);
}

/** 止まったとき、3本のリールの窓の一番上に見える景品の名前。 */
export async function stoppedTopRows(page: Page): Promise<string[]> {
  // 止まった直後は、最後の位置合わせ(CSS の 0.1 秒の移動)が終わるまで待つ
  await page.waitForTimeout(300);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".slot-container .reel")).map((reel) => {
      const box = reel.getBoundingClientRect();
      const rows = Array.from(reel.querySelectorAll<HTMLElement>(".prize-item"));
      const top = rows.find((row) => Math.abs(row.getBoundingClientRect().top - (box.top + reel.clientTop)) < 3);
      return top?.textContent?.trim() ?? "";
    })
  );
}
