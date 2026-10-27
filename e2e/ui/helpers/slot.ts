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

/**
 * 止まったとき、3本のリールの当たりの行(窓の真ん中)に見える景品の名前。
 * 実時間では待たず、「3本とも当たりの行に景品が揃った」状態になるまで待つ(遅い環境でも、揃えば読める)。
 * 位置は JS が決めるので、止まった瞬間から CSS の移動は無い(あれば最後のリールだけ滑って、行がずれる)。
 * 止まった直後の跳ね返り(約0.25秒)の間は行がずれて見えるので、揃うのを待つ。
 */
export async function stoppedWinRows(page: Page): Promise<string[]> {
  const read = () =>
    page.evaluate(() => ({
      transitions: Array.from(document.querySelectorAll<HTMLElement>(".slot-container .reel-content")).map((el) => getComputedStyle(el).transitionDuration),
      rows: Array.from(document.querySelectorAll<HTMLElement>(".slot-container .reel")).map((reel) => {
        const box = reel.getBoundingClientRect();
        const rows = Array.from(reel.querySelectorAll<HTMLElement>(".prize-item"));
        const rowH = rows[0].getBoundingClientRect().height;
        const win = rows.find((row) => Math.abs(row.getBoundingClientRect().top - (box.top + reel.clientTop + rowH)) < 3);
        return win?.textContent?.trim() ?? "";
      }),
    }));
  const first = await read();
  expect(first.transitions, "リールの移動に CSS の transition が掛かっていない").toEqual(["0s", "0s", "0s"]);
  await expect.poll(async () => (await read()).rows.every((r) => r !== ""), { message: "3本とも当たりの行(真ん中)に景品が揃う" }).toBe(true);
  return (await read()).rows;
}

/**
 * 枠(.slot-container)の中に、リールの下の空白が無いこと。リールの上と下の余白が同じ(= 枠の余白が上下対称)で、
 * 左右の余白とも大きくは違わない。結果の欄を空けておくと、下だけ余白が大きくなる(以前の不具合)。
 */
export async function expectNoGapUnderReels(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(".slot-container")!.getBoundingClientRect();
    const reels = document.querySelector<HTMLElement>(".slot-container .slot-reels")!.getBoundingClientRect();
    return { top: reels.top - frame.top, bottom: frame.bottom - reels.bottom, left: reels.left - frame.left, right: frame.right - reels.right };
  });
  expect(Math.abs(m.bottom - m.top), `${label}: リールの下の余白(${m.bottom.toFixed(1)}px)が上(${m.top.toFixed(1)}px)と違う`).toBeLessThanOrEqual(2);
  expect(Math.abs(m.bottom - m.left), `${label}: リールの下の余白(${m.bottom.toFixed(1)}px)が左右(${m.left.toFixed(1)}px)と違う`).toBeLessThanOrEqual(2);
  expect(Math.abs(m.left - m.right), `${label}: 左右の余白が違う`).toBeLessThanOrEqual(2);
}

/** 止める操作の前から仕掛けておく、止まり方の観察(各フレームの位置と、光る・当たりの印)。 */
export interface SlotStopObservation {
  /** 減速の始まり(左のリールが回転の速さから遅くなり始めた時刻、ms)。見つからなければ null。 */
  decelStartMs: number | null;
  /** 各リールが止まった(.landed が付いた)時刻(ms)。付かなければ null。 */
  landedAt: Array<number | null>;
  samples: Array<{ t: number; pos: number[]; landed: boolean[]; hit: boolean; spinning: boolean }>;
}

/** 止める操作の前に呼ぶ。返す関数を操作のあとで呼ぶと、最後のリールが止まって結果を見せている間(約1.5秒)まで見た結果が返る。 */
export async function observeSlotStop(page: Page): Promise<() => Promise<SlotStopObservation>> {
  await page.evaluate(() => {
    const w = window as unknown as { __slotObs?: Promise<unknown> };
    w.__slotObs = new Promise((resolve) => {
      const samples: Array<{ t: number; pos: number[]; landed: boolean[]; hit: boolean; spinning: boolean }> = [];
      const t0 = performance.now();
      let lastLandedAt: number | null = null;
      const frame = () => {
        const container = document.querySelector<HTMLElement>(".slot-container")!;
        const reels = Array.from(container.querySelectorAll<HTMLElement>(".reel"));
        const t = performance.now() - t0;
        samples.push({
          t,
          pos: reels.map((r) => -Number.parseFloat(/translateY\((.*)px\)/.exec(r.querySelector<HTMLElement>(".reel-content")!.style.transform)?.[1] ?? "0")),
          landed: reels.map((r) => r.classList.contains("landed")),
          hit: container.classList.contains("hit"),
          spinning: container.classList.contains("spinning"),
        });
        const last = samples[samples.length - 1];
        if (lastLandedAt === null && last.hit) lastLandedAt = t;
        if ((lastLandedAt !== null && t - lastLandedAt > 1500) || t > 30_000) resolve(samples);
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  });
  return async () => {
    const samples = (await page.evaluate(() => (window as unknown as { __slotObs: Promise<unknown> }).__slotObs)) as SlotStopObservation["samples"];
    // 回転の速さ(止める前の1フレームの動き)。折り返しで戻った分(負の差)は除く
    const deltas = (i: number) => samples.slice(1).map((s, k) => s.pos[i] - samples[k].pos[i]);
    const spinDelta = Math.max(...deltas(0).slice(0, 10), 0);
    const d0 = deltas(0);
    let decelStartMs: number | null = null;
    for (let k = 10; k < d0.length; k++) {
      if (d0[k] >= 0 && d0[k] < spinDelta * 0.85 && samples[k + 1].spinning) {
        decelStartMs = samples[k + 1].t;
        break;
      }
    }
    const landedAt = [0, 1, 2].map((i) => samples.find((s) => s.landed[i])?.t ?? null);
    return { decelStartMs, landedAt, samples };
  };
}
