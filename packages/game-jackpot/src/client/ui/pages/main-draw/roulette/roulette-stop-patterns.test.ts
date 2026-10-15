import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STOP_PATTERNS,
  STOP_PATTERN_DURATION_FACTOR,
  calculatePatternRotation,
  calculateTargetRotation,
  pickStopPattern,
  type StopPattern,
} from "./roulette-angle-utils";
import { useRouletteAnimator } from "./roulette-animator";
import type { InternalRouletteItem } from "./roulette-image-loader";

const TAU = Math.PI * 2;
const SECTOR = TAU / 8;

afterEach(() => vi.restoreAllMocks());

describe("止まり方の軌道(calculatePatternRotation)", () => {
  const start = 1.3;
  const total = start + TAU * 4 + 0.9;
  const at = (pattern: StopPattern, p: number) => calculatePatternRotation(pattern, total, start, p, SECTOR);

  it("どの止まり方も、最初は開始の角度から始まり、最後はちょうど当選の角度に止まる", () => {
    for (const pattern of STOP_PATTERNS) {
      expect(at(pattern, 0), pattern).toBeCloseTo(start, 9);
      expect(at(pattern, 1), pattern).toBeCloseTo(total, 9);
      // 範囲外の進み具合でも当選の角度に収まる(最後のフレームが少し遅れても外れない)
      expect(at(pattern, 1.7), pattern).toBeCloseTo(total, 9);
      expect(at(pattern, -1), pattern).toBeCloseTo(start, 9);
    }
  });

  it("途中でとんでもない位置へ飛ばない(急な跳びがない)", () => {
    for (const pattern of STOP_PATTERNS) {
      let prev = at(pattern, 0);
      for (let i = 1; i <= 2000; i++) {
        const cur = at(pattern, i / 2000);
        // 1/2000 の進み具合で、1マス(SECTOR)以上は動かない
        expect(Math.abs(cur - prev), `${pattern} @${i}`).toBeLessThan(SECTOR);
        prev = cur;
      }
    }
  });

  it("normal・creep・fakeout・nearMiss は逆走しない。overshoot だけが、当選を通り過ぎてから戻る", () => {
    for (const pattern of ["normal", "creep", "fakeout", "nearMiss"] as const) {
      let prev = at(pattern, 0);
      for (let i = 1; i <= 2000; i++) {
        const cur = at(pattern, i / 2000);
        expect(cur, `${pattern} @${i}`).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(cur, `${pattern} @${i}`).toBeLessThanOrEqual(total + 1e-9);
        prev = cur;
      }
    }
    let max = -Infinity;
    for (let i = 0; i <= 2000; i++) max = Math.max(max, at("overshoot", i / 2000));
    expect(max).toBeGreaterThan(total + SECTOR * 0.5);
    expect(max).toBeLessThan(total + SECTOR * 1.5);
  });

  it("nearMiss は、当選の1マス手前でしばらく止まる。fakeout は、止まっている間に動かない", () => {
    expect(at("nearMiss", 0.65)).toBeCloseTo(total - SECTOR, 9);
    expect(at("nearMiss", 0.78)).toBeCloseTo(total - SECTOR, 9);
    const held = at("fakeout", 0.5);
    expect(at("fakeout", 0.55)).toBeCloseTo(held, 9);
    expect(held).toBeLessThan(total - SECTOR * 4); // まだ当選の手前、遠くで止まったように見える
  });

  it("creep は、終盤に当選の手前の数マスをゆっくり進む", () => {
    const early = at("creep", 0.5);
    expect(total - early).toBeCloseTo(SECTOR * 2.5, 9);
    // 後半の半分の時間で、2.5マスしか進まない = 前半に比べて十分遅い
    expect(early - start).toBeGreaterThan(SECTOR * 20);
  });
});

describe("止まり方の選び方(pickStopPattern)", () => {
  it("乱数の全域で、全種類が出る。端の値でも壊れない", () => {
    const seen = new Set<StopPattern>();
    for (let i = 0; i < 1000; i++) seen.add(pickStopPattern(() => i / 1000));
    expect([...seen].sort()).toEqual([...STOP_PATTERNS].sort());
    expect(STOP_PATTERNS).toContain(pickStopPattern(() => 0));
    expect(STOP_PATTERNS).toContain(pickStopPattern(() => 0.999999));
  });

  it("ふつうの止まり方も、一定の割合(2〜5割)で出る", () => {
    let normal = 0;
    for (let i = 0; i < 1000; i++) if (pickStopPattern(() => i / 1000) === "normal") normal++;
    expect(normal).toBeGreaterThanOrEqual(200);
    expect(normal).toBeLessThanOrEqual(500);
  });

  it("どの止まり方も、減速の時間は伸びるだけ(短くならない)", () => {
    for (const pattern of STOP_PATTERNS) expect(STOP_PATTERN_DURATION_FACTOR[pattern], pattern).toBeGreaterThanOrEqual(1);
  });
});

/** requestAnimationFrame と時計を手で進めて、止まるまでの回転角を全フレーム記録する。 */
async function spinAndStop(pattern: StopPattern | undefined, durationSec: number, occurrence = 1) {
  const callbacks: FrameRequestCallback[] = [];
  let time = 0;
  const rotations: number[] = [];
  const items: InternalRouletteItem[] = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, index: i, name: `p${i}`, imageElement: undefined as unknown as HTMLImageElement }));
  const animator = useRouletteAnimator(
    { raf: (cb) => callbacks.push(cb), cancelRaf: () => callbacks.splice(0, callbacks.length), now: () => time },
    (rotation) => rotations.push(rotation)
  );
  const frame = () => {
    time += 16;
    const cb = callbacks.shift();
    cb?.(time);
  };
  await animator.startSpin(1, 16);
  for (let i = 0; i < 90; i++) frame(); // 加速して、回っている状態にする
  let done = false;
  const stopped = (pattern ? animator.stopSpin("p3", items, SECTOR, durationSec, occurrence, pattern) : animator.stopSpin("p3", items, SECTOR, durationSec, occurrence)).then((id) => {
    done = true;
    return id;
  });
  let frames = 0;
  const before = rotations.length;
  while (!done && frames < 20_000) {
    frame();
    frames++;
    await Promise.resolve();
  }
  const id = await stopped;
  return { id, frames, rotations: rotations.slice(before), animator, seconds: time / 1000 };
}

describe("useRouletteAnimator.stopSpin の止まり方", () => {
  it("どの止まり方でも、当選の景品のマスに止まり、止まった後は動かない", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // 当選の位置をマスの中央に固定
    const expected = calculateTargetRotation(3, SECTOR); // = 3.5 マス目の中央 + 90度
    for (const pattern of STOP_PATTERNS) {
      const { id, rotations, animator } = await spinAndStop(pattern, 3);
      expect(id, pattern).toBe("p3");
      const last = rotations[rotations.length - 1];
      const diff = ((last - expected) % TAU + TAU * 1.5) % TAU - Math.PI; // -π〜π の差
      expect(Math.abs(diff), `${pattern}: 当選のマスの中央に止まる`).toBeLessThan(1e-6);
      expect(animator.spinning.value, pattern).toBe(false);
    }
  });

  it("指定しなければ従来どおり(normal)。どの止まり方も、すぐ止まらず・長くなりすぎない", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const base = await spinAndStop(undefined, 3);
    const normal = await spinAndStop("normal", 3);
    expect(normal.frames).toBe(base.frames);
    for (const pattern of STOP_PATTERNS) {
      const r = await spinAndStop(pattern, 3);
      const sec = (r.frames * 16) / 1000;
      expect(sec, `${pattern}`).toBeGreaterThanOrEqual(3 * STOP_PATTERN_DURATION_FACTOR[pattern] - 0.1);
      expect(sec, `${pattern}`).toBeLessThanOrEqual(3 * STOP_PATTERN_DURATION_FACTOR[pattern] + 0.2);
      expect(sec, `${pattern}`).toBeLessThanOrEqual(6); // 3秒の指定でも、意地悪でも6秒以内
    }
  });

  it("複数回転する当選(同じ景品が複数ある確変の最終)でも、各止まり方で目的の出現位置に止まる", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const callbacks: FrameRequestCallback[] = [];
    let time = 0;
    const items: InternalRouletteItem[] = Array.from({ length: 8 }, (_, i) => ({ id: i === 2 || i === 6 ? "dup" : `p${i}`, index: i, name: `p${i}`, imageElement: undefined as unknown as HTMLImageElement }));
    for (const pattern of STOP_PATTERNS) {
      const rotations: number[] = [];
      const animator = useRouletteAnimator({ raf: (cb) => callbacks.push(cb), cancelRaf: () => callbacks.splice(0, callbacks.length), now: () => time }, (r) => rotations.push(r));
      await animator.startSpin(1, 16);
      for (let i = 0; i < 60; i++) {
        time += 16;
        callbacks.shift()?.(time);
      }
      let done = false;
      const p = animator.stopSpin("dup", items, SECTOR, 3, 2, pattern).then((id) => ((done = true), id));
      for (let i = 0; i < 20_000 && !done; i++) {
        time += 16;
        callbacks.shift()?.(time);
        await Promise.resolve();
      }
      expect(await p).toBe("dup");
      const expected = calculateTargetRotation(6, SECTOR); // 2番目の出現 = index 6
      const last = rotations[rotations.length - 1];
      const diff = ((last - expected) % TAU + TAU * 1.5) % TAU - Math.PI;
      expect(Math.abs(diff), pattern).toBeLessThan(1e-6);
    }
  });
});
