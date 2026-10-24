import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

/**
 * 端末ごとの幅ではなく「どの幅でも成立する」ことを確かめるための寸法。
 * 小さい端末(〜280)からタブレット・横向き・小さいデスクトップまで、幅を連続的に掃引する。
 */
export const SWEEP_SIZES: ReadonlyArray<{ width: number; height: number }> = [
  ...[280, 300, 320, 340, 360, 375, 390, 412, 430, 480, 540, 600, 768, 820, 1024, 1100].map((width) => ({ width, height: 800 })),
  // 横向き(高さが低い)
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
];

/** OSの文字サイズ拡大・ブラウザのズーム相当(ルートの文字サイズの倍率)。 */
export const SWEEP_FONT_SCALES = [1, 1.6] as const;

/**
 * いまの画面が、SWEEP_SIZES × SWEEP_FONT_SCALES のどの組み合わせでも横にはみ出さないことを確かめる。
 * 画面の見た目だけを切り替えるので軽い(通信や操作は発生しない)。終わったら元の寸法と文字サイズに戻す。
 */
export async function expectFitsEverySize(page: Page, label: string) {
  const original = page.viewportSize();
  try {
    for (const scale of SWEEP_FONT_SCALES) {
      await page.evaluate((pct) => (document.documentElement.style.fontSize = `${pct}%`), scale * 100);
      for (const size of SWEEP_SIZES) {
        await page.setViewportSize(size);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        await expectNoHorizontalOverflow(page, `${label} ${size.width}x${size.height} 文字x${scale}`);
      }
    }
  } finally {
    await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
    if (original) await page.setViewportSize(original);
  }
}

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
      if (style.display === "none" || style.visibility === "hidden") continue;
      // 公開の瞬間に弾ける飾り(紙吹雪)は、自分の枠(overflow:hidden)の中でだけ見える。飛んでいる途中は端を越えて見えるが、切られて問題ない
      if (el.closest('[data-testid^="reveal-burst-"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // 固定表示(ヘッダ・下部タブなど)は、左右とも画面内に収まっているべき
      if (style.position === "fixed") {
        if (r.left < -1 || r.right > limit) out.push(`${el.tagName.toLowerCase()}.${el.className?.toString().split(" ")[0] ?? ""}(固定 ${Math.round(r.left)}〜${Math.round(r.right)})`);
        continue;
      }
      // 横スクロール用の枠の中身は、枠側で見える範囲に収まっていればよい
      let scrollable = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") scrollable = true;
      }
      if (scrollable) continue;
      if (r.right > limit) out.push(`${el.tagName.toLowerCase()}.${el.className?.toString().split(" ")[0] ?? ""}(右端 ${Math.round(r.right)})`);
      else if (r.left < -1) out.push(`${el.tagName.toLowerCase()}.${el.className?.toString().split(" ")[0] ?? ""}(左端 ${Math.round(r.left)})`);
    }
    return out.slice(0, 5);
  });
  expect(clipped, `${label}: 画面の端を越えている要素がある`).toEqual([]);
}
