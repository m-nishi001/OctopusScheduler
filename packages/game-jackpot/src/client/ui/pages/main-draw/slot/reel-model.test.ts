import { describe, expect, it } from "vitest";
import {
  MIN_LOOP_LENGTH,
  WINDOW_ROWS,
  advancePosition,
  buildLoop,
  cycleHeight,
  indexInLoop,
  positionForIndex,
  renderedCount,
  windowWithinStrip,
  wrapPosition,
} from "./reel-model";

const prize = (id: string) => ({ id, name: id });

describe("buildLoop", () => {
  it("景品が少なくても、最短の長さまで繰り返して埋める", () => {
    for (const n of [1, 2, 3, 7]) {
      const loop = buildLoop(Array.from({ length: n }, (_, i) => prize(`p${i}`)));
      expect(loop).toHaveLength(MIN_LOOP_LENGTH);
      expect(loop[0].id).toBe("p0");
    }
  });

  it("景品が最短の長さより多いときは、全部を切らずにそのまま使う", () => {
    const loop = buildLoop(Array.from({ length: 25 }, (_, i) => prize(`p${i}`)));
    expect(loop).toHaveLength(25);
  });

  it("景品が無ければ空", () => {
    expect(buildLoop([])).toEqual([]);
    expect(renderedCount(0)).toBe(0);
  });
});

describe("wrapPosition / advancePosition", () => {
  it("負の値や1周以上の値も 0 以上 1周未満に収める", () => {
    expect(wrapPosition(-10, 100)).toBe(90);
    expect(wrapPosition(250, 100)).toBe(50);
    expect(wrapPosition(100, 100)).toBe(0);
    expect(wrapPosition(5, 0)).toBe(0);
  });

  it("進めて1周を越えても、元の位置から途切れず続く", () => {
    expect(advancePosition(95, 10, 100)).toBe(5);
  });
});

describe("窓が帯の外(黒)を映さない(今回の不具合)", () => {
  it("どのループ長・マスの高さ・速度でも、毎フレームで窓は帯の内側に収まる", () => {
    for (const loopLength of [1, 3, 10, 25]) {
      for (const itemHeight of [64, 97, 170]) {
        const cycle = cycleHeight(loopLength, itemHeight);
        for (const speed of [10, 12, 14, 33]) {
          let position = 0;
          for (let frame = 0; frame < 2000; frame++) {
            position = advancePosition(position, speed, cycle);
            expect(windowWithinStrip(position, loopLength, itemHeight), `len=${loopLength} h=${itemHeight} v=${speed} f=${frame}`).toBe(true);
          }
        }
      }
    }
  });

  it("旧方式(帯の末尾で0に戻す)は、末尾付近で窓が帯を越える", () => {
    const itemHeight = 64;
    const stripHeight = 10 * itemHeight;
    // 旧: 10マスだけ描画し、窓は3マス分。位置が7マスより先だと窓の下が空白になる
    expect(8 * itemHeight + WINDOW_ROWS * itemHeight > stripHeight).toBe(true);
    // 新: 描画は ループ + 窓の高さ分
    expect(windowWithinStrip(8 * itemHeight, 10, itemHeight)).toBe(true);
  });

  it("帯の継ぎ目の前後で、窓に見える景品の並びが同じ(継ぎ目が見えない)", () => {
    const loop = buildLoop([prize("a"), prize("b"), prize("c")]);
    const itemHeight = 50;
    const cycle = cycleHeight(loop.length, itemHeight);
    const rowsAt = (position: number) => {
      const first = Math.floor(position / itemHeight);
      return Array.from({ length: WINDOW_ROWS }, (_, r) => loop[(first + r) % loop.length].id);
    };
    // 1周ちょうどで折り返した位置は、最初の位置と見える並びが一致する
    expect(rowsAt(wrapPosition(cycle, cycle))).toEqual(rowsAt(0));
    // 折り返す直前の窓は、末尾 → 先頭 → 次 と、輪としてつながって見える
    expect(rowsAt(cycle - itemHeight)).toEqual([loop[loop.length - 1].id, loop[0].id, loop[1].id]);
  });
});

describe("停止位置", () => {
  it("どの景品に止めても、窓は帯の内側に収まり、指定の景品が一番上に来る", () => {
    const prizes = ["a", "b", "c", "d"].map(prize);
    const loop = buildLoop(prizes);
    const itemHeight = 80;
    const cycle = cycleHeight(loop.length, itemHeight);
    for (const p of prizes) {
      const index = indexInLoop(loop, p.id);
      expect(index).toBeGreaterThanOrEqual(0);
      const position = positionForIndex(index, itemHeight, cycle);
      expect(windowWithinStrip(position, loop.length, itemHeight)).toBe(true);
      expect(loop[Math.round(position / itemHeight) % loop.length].id).toBe(p.id);
    }
  });

  it("ループの末尾の景品に止めても、窓の下が空白にならない", () => {
    const loop = buildLoop(Array.from({ length: 10 }, (_, i) => prize(`p${i}`)));
    const itemHeight = 64;
    const cycle = cycleHeight(loop.length, itemHeight);
    expect(windowWithinStrip(positionForIndex(9, itemHeight, cycle), loop.length, itemHeight)).toBe(true);
  });

  it("見つからない景品ID・未指定は -1", () => {
    const loop = buildLoop([prize("a")]);
    expect(indexInLoop(loop, "zzz")).toBe(-1);
    expect(indexInLoop(loop, null)).toBe(-1);
  });
});
