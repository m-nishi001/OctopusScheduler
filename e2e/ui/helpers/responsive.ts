import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

/** 横スクロールが出ていない(はみ出していない)ことを確認する。 */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${label}: 横にはみ出している(${scrollWidth} > ${clientWidth})`).toBeLessThanOrEqual(clientWidth + 1);

  // PageShell などは overflow-x:hidden で内容を切るため、ページ全体の幅だけでは見逃す。
  // 画面の右端を越えて見えている要素(=切られている内容)がないかも確認する。
  const clipped = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth + 1;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // 横スクロール用の枠の中身は、枠側で見える範囲に収まっていればよい
      let scrollable = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") scrollable = true;
      }
      if (scrollable) continue;
      if (r.right > limit) out.push(`${el.tagName.toLowerCase()}.${el.className?.toString().split(" ")[0] ?? ""}(右端 ${Math.round(r.right)})`);
    }
    return out.slice(0, 5);
  });
  expect(clipped, `${label}: 画面の右端を越えている要素がある`).toEqual([]);
}
