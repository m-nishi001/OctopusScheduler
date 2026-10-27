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

/**
 * 全画面の演出(順位発表・当選)が、縦にスクロールせず、画面の縦の真ん中に出ていることを確かめる。
 * 紙吹雪は落ち続けるので、durationMs の間 250ms ごとに測り直す。
 * 横向き(landscape)は中身が画面より高くなりうるので、本文の内側のスクロールは許し、
 * 演出の枠そのものがスクロールしないことだけを見る(中央寄せは見ない)。
 * E2E_SHOTS_DIR があるときだけ、測るたびのスクリーンショットを shotPrefix 付きで保存する。
 */
export async function expectOverlayCenteredWithoutScroll(
  page: Page,
  testId: string,
  label: string,
  opts: { durationMs?: number; landscape?: boolean; shotPrefix?: string } = {}
) {
  const durationMs = opts.durationMs ?? 4000;
  const shotsDir = process.env.E2E_SHOTS_DIR;
  const shotAt = new Set([0, 2000, 4000]);
  const start = Date.now();
  let nextShot = 0;
  for (let i = 0; ; i++) {
    const elapsed = Date.now() - start;
    const m = await page.evaluate((id) => {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!el) return null;
      const body = el.querySelector<HTMLElement>('[class*="__body"]');
      const r = (body ?? el).getBoundingClientRect();
      // overflow:hidden の枠は紙吹雪で scrollHeight が伸びても、スクロールバーは出ない。「スクロールできる枠」だけを見る
      const probe = (n: HTMLElement | null) => {
        if (!n) return { scrollable: false, over: 0, bar: 0 };
        const oy = getComputedStyle(n).overflowY;
        const scrollable = oy === "auto" || oy === "scroll";
        const bar = n.offsetWidth - n.clientWidth;
        return { scrollable, over: n.scrollHeight - n.clientHeight, bar };
      };
      return {
        root: probe(el),
        body: probe(body),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        bodyCenterY: r.top + r.height / 2,
        viewportH: window.innerHeight,
      };
    }, testId);
    expect(m, `${label}: ${testId} が見つからない`).not.toBeNull();
    const t = `${label} t=${Math.round(elapsed)}ms`;
    expect(m!.root.scrollable && m!.root.over > 1, `${t}: 枠がスクロールできる状態で、中身がはみ出している(${m!.root.over}px)`).toBe(false);
    expect(m!.root.bar, `${t}: 枠にスクロールバーが出ている`).toBeLessThanOrEqual(0);
    expect(m!.body.bar, `${t}: 本文にスクロールバーが出ている`).toBeLessThanOrEqual(0);
    if (!opts.landscape) {
      expect(m!.body.scrollable && m!.body.over > 1, `${t}: 本文がスクロールになっている(${m!.body.over}px)`).toBe(false);
    }
    if (!opts.landscape) {
      const off = Math.abs(m!.bodyCenterY - m!.viewportH / 2);
      expect(off, `${t}: 縦の真ん中からずれている(${Math.round(off)}px)`).toBeLessThanOrEqual(m!.viewportH * 0.12);
    }
    if (shotsDir && opts.shotPrefix && elapsed >= nextShot) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(shotsDir, { recursive: true });
      const sec = [...shotAt].filter((s) => s <= elapsed).pop() ?? 0;
      await page.screenshot({ path: `${shotsDir}/${opts.shotPrefix}-t${sec / 1000}s.png` });
      nextShot = sec + 2000;
    }
    if (elapsed >= durationMs) break;
    await page.waitForTimeout(250);
  }
}
