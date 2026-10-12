import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * アニメーション(カウントダウン・抽選の回転/停止など)を「断片的に」確認するためのヘルパー。
 * 一定間隔でスクリーンショットを撮り、(1) フレーム同士が違う=動いている / 同じ=止まっている を判定し、
 * (2) 撮った画像を Playwright の添付(CI では artifact)と E2E_SHOTS に残す。
 * PNG は同じ見た目なら同じバイト列になるため、ピクセル比較ライブラリは使わずバッファの一致で判定する。
 */
export interface Frame {
  at: number;
  png: Buffer;
}

type Target = Page | Locator;
interface TimelineOptions {
  count?: number;
  intervalMs?: number;
}

/** intervalMs ごとに count 枚撮る。範囲を絞りたい時は Locator を渡す(その要素の範囲だけ撮る)。 */
export async function captureTimeline(target: Target, name: string, options: TimelineOptions = {}): Promise<Frame[]> {
  const { count = 4, intervalMs = 500 } = options;
  const frames: Frame[] = [];
  const started = Date.now();
  for (let i = 0; i < count; i++) {
    frames.push({ at: Date.now() - started, png: await target.screenshot({ animations: "allow" }) });
    if (i < count - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  await attachFrames(name, frames);
  return frames;
}

async function attachFrames(name: string, frames: Frame[]): Promise<void> {
  const dir = process.env.E2E_SHOTS;
  if (dir) mkdirSync(dir, { recursive: true });
  for (const [i, f] of frames.entries()) {
    const file = `${name}-${String(i + 1).padStart(2, "0")}.png`;
    try {
      await test.info().attach(file, { body: f.png, contentType: "image/png" });
    } catch {
      // test の外(ヘルパー単体の呼び出し)では添付しない
    }
    if (dir) writeFileSync(join(dir, file), f.png);
  }
}

/** 連続するフレームのうち、前と違うものの数。 */
export function changedFrames(frames: Frame[]): number {
  let n = 0;
  for (let i = 1; i < frames.length; i++) if (!frames[i].png.equals(frames[i - 1].png)) n++;
  return n;
}

/** 動いている(半数以上のコマで変化している)ことを確認する。 */
export async function expectAnimating(target: Target, name: string, options: TimelineOptions = {}) {
  const frames = await captureTimeline(target, name, options);
  expect(changedFrames(frames), `${name}: 動いているはずなのに画面が変化していない`).toBeGreaterThanOrEqual(
    Math.max(1, Math.floor((frames.length - 1) / 2))
  );
}

/** 止まっている(全フレームが同一)ことを確認する。 */
export async function expectStill(target: Target, name: string, options: TimelineOptions = {}) {
  const frames = await captureTimeline(target, name, { count: 3, ...options });
  expect(changedFrames(frames), `${name}: 止まっているはずなのに画面が変化している`).toBe(0);
}

/** 要素の数値テキスト(カウントダウン等)が減っていくことを確認する。 */
export async function expectCountingDown(locator: Locator, options: { samples?: number; intervalMs?: number } = {}) {
  const { samples = 3, intervalMs = 1100 } = options;
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    const text = (await locator.innerText()).match(/\d+/)?.[0];
    expect(text, "数値が表示されていない").toBeDefined();
    values.push(Number(text));
    if (i < samples - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  expect(values[values.length - 1], `カウントダウンしていない: ${values.join(",")}`).toBeLessThan(values[0]);
}
