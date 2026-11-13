import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import sharp from "sharp";

/**
 * マニュアル用スクリーンショットの撮影ヘルパー(`e2e/ui/manual-screenshots.spec.ts` が使う)。
 * 撮る前に、説明文の番号に対応する要素へ赤い枠と番号バッジを重ねる(DOMに一時的に足し、撮ったら消す)。
 * 出力は webp(幅は viewport × deviceScaleFactor。既存の画像と同じ寸法)。
 */

/** 書き出し先(既定は docs/assets/images)。 */
export const OUT_DIR = resolve(process.env.DOCS_SHOTS_OUT ?? fileURLToPath(new URL("../../../docs/assets/images", import.meta.url)));
/** 名前の正規表現で撮る画像を絞る(例: DOCS_SHOTS_ONLY='^a-1'。作り直しの試行用)。 */
const ONLY = process.env.DOCS_SHOTS_ONLY ? new RegExp(process.env.DOCS_SHOTS_ONLY) : undefined;

export const wanted = (name: string) => !ONLY || ONLY.test(name);

export const done: string[] = [];
export const failed: Array<{ name: string; reason: string }> = [];

/** 要素に枠と番号バッジを重ねる。見つからない要素があれば例外(撮り直しの対象が分かるよう、番号を含める)。 */
/** 印を付ける対象。複数の要素を渡すと、それらをまとめて囲む1つの枠にする。 */
export type Mark = Locator | Locator[];

async function boxOf(loc: Locator) {
  return loc.first().boundingBox({ timeout: 5_000 }).catch(() => null);
}

async function overlay(page: Page, marks: Mark[]): Promise<void> {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (const [i, mark] of marks.entries()) {
    const parts = Array.isArray(mark) ? mark : [mark];
    const found = (await Promise.all(parts.map(boxOf))).filter((b): b is NonNullable<typeof b> => b !== null);
    if (found.length !== parts.length) throw new Error(`番号${i + 1}の要素が見つからない`);
    const x = Math.min(...found.map((b) => b.x));
    const y = Math.min(...found.map((b) => b.y));
    boxes.push({ x, y, width: Math.max(...found.map((b) => b.x + b.width)) - x, height: Math.max(...found.map((b) => b.y + b.height)) - y });
  }
  await page.evaluate((list) => {
    const root = document.createElement("div");
    root.id = "manual-shot-overlay";
    root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    list.forEach((b, i) => {
      const ring = document.createElement("div");
      ring.style.cssText = `position:absolute;left:${b.x - 3}px;top:${b.y - 3}px;width:${b.width + 6}px;height:${b.height + 6}px;border:2px solid #ef4444;border-radius:8px;box-shadow:0 0 0 2px rgba(255,255,255,.55)`;
      const badge = document.createElement("div");
      badge.textContent = String(i + 1);
      const bx = Math.max(2, b.x - 14);
      const by = Math.max(2, b.y - 14);
      badge.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:28px;height:28px;border-radius:50%;background:#ef4444;color:#fff;font:700 16px/28px sans-serif;text-align:center;border:2px solid #fff;box-sizing:border-box;line-height:24px`;
      root.append(ring, badge);
    });
    document.body.append(root);
  }, boxes);
}

const clearOverlay = (page: Page) => page.evaluate(() => document.getElementById("manual-shot-overlay")?.remove());

/** 1枚撮って webp で書き出す。失敗しても例外にせず failed に積む(他の画像は撮り続ける)。 */
export async function shoot(page: Page, name: string, marks: Mark[] = [], options: { fullPage?: boolean } = {}): Promise<void> {
  if (!wanted(name)) return;
  try {
    await page.mouse.move(0, 0);
    if (marks.length) await overlay(page, marks);
    const png = await page.screenshot({ fullPage: options.fullPage ?? false, animations: "allow", caret: "hide" });
    mkdirSync(OUT_DIR, { recursive: true });
    await sharp(png).webp({ quality: 82 }).toFile(join(OUT_DIR, `${name}.webp`));
    done.push(name);
  } catch (e) {
    failed.push({ name, reason: String((e as Error).message).split("\n")[0].slice(0, 160) });
  } finally {
    await clearOverlay(page).catch(() => undefined);
  }
}

/** 1つの撮影場面(画面を用意する処理)を、失敗しても続けて実行する。引数 names のどれかが対象のときだけ実行する。 */
export async function scene(names: string[], run: () => Promise<void>): Promise<void> {
  if (!names.some(wanted)) return;
  try {
    await run();
  } catch (e) {
    for (const name of names) {
      if (wanted(name) && !done.includes(name) && !failed.some((f) => f.name === name)) failed.push({ name, reason: `場面の準備に失敗: ${String((e as Error).message).split("\n")[0].slice(0, 140)}` });
    }
  }
}
