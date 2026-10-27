import { describe, expect, it } from "vitest";
import {
  MIN_LOOP_LENGTH,
  STOP_BASE_MS,
  STOP_STAGGER_MS,
  WINDOW_ROWS,
  adjacentSameNameCount,
  advancePosition,
  buildReelLoop,
  computeSlotSize,
  cycleHeight,
  easeStop,
  fillLoop,
  planStop,
  positionAtStop,
  positionForIndex,
  renderedCount,
  separateSameNames,
  spinSpeed,
  stopDurationMs,
  windowWithinStrip,
  wrapPosition,
} from "./reel-model";

const prize = (id: string) => ({ id, name: id });
const named = (id: string, name: string) => ({ id, name });
/** mulberry32: 同じ種なら同じ列になる乱数。 */
const rngOf = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const makeItems = (names: string[]) => names.map((n, i) => named(`i${i}`, n));

describe("fillLoop", () => {
  it("景品が少なくても、最短の長さまで繰り返して埋める", () => {
    for (const n of [1, 2, 3, 7]) {
      const loop = fillLoop(Array.from({ length: n }, (_, i) => prize(`p${i}`)));
      expect(loop.length).toBeGreaterThanOrEqual(MIN_LOOP_LENGTH);
      expect(loop[0].id).toBe("p0");
    }
  });

  it("景品が最短の長さより多いときは、全部を切らずにそのまま使う", () => {
    expect(fillLoop(Array.from({ length: 25 }, (_, i) => prize(`p${i}`)))).toHaveLength(25);
  });

  it("景品が無ければ空", () => {
    expect(fillLoop([])).toEqual([]);
    expect(buildReelLoop([], rngOf(1))).toEqual([]);
    expect(renderedCount(0)).toBe(0);
  });

  it("名前の数が偏らない(足す景品は一番少ない名前から)。2種類なら長さが偶数で同数になる", () => {
    const loop = fillLoop(makeItems(["A", "A", "B"]));
    expect(loop.length % 2).toBe(0);
    expect(loop.filter((i) => i.name === "A")).toHaveLength(loop.length / 2);
  });

  it("元の景品は(同じ名前の複製も)全部残る", () => {
    const items = makeItems(["A", "A", "B", "C"]);
    expect(fillLoop(items).map((i) => i.id)).toEqual(expect.arrayContaining(items.map((i) => i.id)));
  });
});

describe("buildReelLoop(同じ名前が隣り合わない)", () => {
  const cases: Array<[string, string[]]> = [
    ["8種類(ルーレットと同じ用意済み)", ["a", "b", "c", "d", "e", "f", "g", "h"]],
    ["5種類", ["a", "b", "c", "d", "e"]],
    ["3種類", ["a", "b", "c"]],
    ["同じ名前が複数(確変の複製)", ["A", "A", "B", "C"]],
    ["同じ名前の景品が混ざる8件", ["a", "a", "b", "c", "c", "d", "e", "f"]],
    ["多い名前が半数ちょうど", ["A", "A", "A", "A", "A", "B", "C", "D", "E", "F"]],
    ["20種類(最短より多い)", Array.from({ length: 20 }, (_, i) => `n${i}`)],
  ];
  for (const [label, names] of cases) {
    it(`${label}: 多数の乱数で、継ぎ目も含めて隣り合わない`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const loop = buildReelLoop(makeItems(names), rngOf(seed));
        expect(adjacentSameNameCount(loop), `seed=${seed} ${loop.map((i) => i.name).join("")}`).toBe(0);
      }
    });
  }

  it("2種類は交互になる(景品の数が奇数でも偶数でも)", () => {
    for (const names of [["A", "B"], ["A", "A", "B"], ["A", "B", "B", "B"]]) {
      for (let seed = 1; seed <= 50; seed++) {
        expect(adjacentSameNameCount(buildReelLoop(makeItems(names), rngOf(seed)))).toBe(0);
      }
    }
  });

  it("乱数が両端の値(0 / 0.999… / 1)でも壊れない", () => {
    for (const v of [0, 0.5, 0.9999999, 1]) {
      const loop = buildReelLoop(makeItems(["a", "b", "c", "d"]), () => v);
      expect(loop.length).toBeGreaterThanOrEqual(MIN_LOOP_LENGTH);
      expect(adjacentSameNameCount(loop)).toBe(0);
    }
  });

  it("リールごとに別の乱数なら、並びが違う", () => {
    const names = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const order = (seed: number) =>
      buildReelLoop(makeItems(names), rngOf(seed))
        .map((i) => i.id)
        .join(",");
    expect(new Set([order(1), order(2), order(3)]).size).toBe(3);
  });

  it("同じ乱数なら同じ並び(再現できる)", () => {
    const items = makeItems(["a", "b", "c", "d", "e"]);
    expect(buildReelLoop(items, rngOf(7))).toEqual(buildReelLoop(items, rngOf(7)));
  });

  it("元の景品は全部ある(当選景品が必ず輪の中にいる)", () => {
    const items = makeItems(["a", "b", "c", "d", "e", "f", "g", "h"]);
    for (let seed = 1; seed <= 50; seed++) {
      const ids = buildReelLoop(items, rngOf(seed)).map((i) => i.id);
      for (const item of items) expect(ids).toContain(item.id);
    }
  });

  it("規則的な並びにならない(同じ景品の間隔が一定でない)", () => {
    const loop = buildReelLoop(makeItems(["a", "b", "c", "d", "e", "f", "g", "h"]), rngOf(11));
    const gaps = new Set<number>();
    loop.forEach((item, i) => {
      const next = loop.findIndex((x, j) => j > i && x.name === item.name);
      if (next > 0) gaps.add(next - i);
    });
    expect(gaps.size).toBeGreaterThan(1);
  });

  describe("作れないときは、できるだけ避ける(途中で止まらない)", () => {
    it("名前が1種類: 例外にならず、最短の長さまで埋める", () => {
      const loop = buildReelLoop(makeItems(["A"]), rngOf(1));
      expect(loop.length).toBeGreaterThanOrEqual(MIN_LOOP_LENGTH);
      expect(new Set(loop.map((i) => i.name)).size).toBe(1);
    });

    it("1つの名前が半数を超える: 例外にならず、全部の景品を含む", () => {
      const items = makeItems(["A", "A", "A", "A", "A", "A", "A", "A", "B", "C", "D", "E"]);
      const loop = buildReelLoop(items, rngOf(3));
      expect(loop).toHaveLength(items.length);
      expect(loop.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
    });

    it("3マス未満の輪は並べ替えない", () => {
      expect(separateSameNames([prize("a"), prize("b")], rngOf(1)).map((i) => i.id)).toEqual(["a", "b"]);
    });
  });

  it("adjacentSameNameCount: 末尾と先頭の継ぎ目も数える。1マスは 0", () => {
    expect(adjacentSameNameCount([named("1", "A"), named("2", "B"), named("3", "A")])).toBe(1);
    expect(adjacentSameNameCount([named("1", "A")])).toBe(0);
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
    const loop = buildReelLoop([prize("a"), prize("b"), prize("c")], rngOf(5));
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
    const loop = buildReelLoop(prizes, rngOf(2));
    const itemHeight = 80;
    const cycle = cycleHeight(loop.length, itemHeight);
    for (const p of prizes) {
      const index = loop.findIndex((x) => x.id === p.id);
      const position = positionForIndex(index, itemHeight, cycle);
      expect(windowWithinStrip(position, loop.length, itemHeight)).toBe(true);
      expect(loop[Math.round(position / itemHeight) % loop.length].id).toBe(p.id);
    }
  });

  it("ループの末尾の景品に止めても、窓の下が空白にならない", () => {
    const loop = buildReelLoop(Array.from({ length: 10 }, (_, i) => prize(`p${i}`)), rngOf(1));
    const itemHeight = 64;
    const cycle = cycleHeight(loop.length, itemHeight);
    expect(windowWithinStrip(positionForIndex(9, itemHeight, cycle), loop.length, itemHeight)).toBe(true);
  });
});

describe("planStop(減速して止まる)", () => {
  const loop = buildReelLoop(["a", "b", "c", "d", "e", "f", "g", "h"].map(prize), rngOf(4));
  const itemHeight = 100;
  const cycle = cycleHeight(loop.length, itemHeight);
  const base = { loop, itemHeight, speedPerFrame: spinSpeed(0, itemHeight), durationMs: STOP_BASE_MS };

  it("どの位置から止めても、指定の景品のマスの位置で止まり、前へ進む", () => {
    for (const target of loop) {
      for (let position = 0; position < cycle; position += 37) {
        const plan = planStop({ ...base, targetId: target.id, position })!;
        expect(plan.to).toBeGreaterThan(plan.from);
        const stopAt = wrapPosition(plan.to, cycle);
        expect(loop[Math.round(stopAt / itemHeight) % loop.length].id).toBe(target.id);
        expect(stopAt % itemHeight).toBeCloseTo(0, 6);
        expect(windowWithinStrip(stopAt, loop.length, itemHeight)).toBe(true);
      }
    }
  });

  it("回転の速さから途切れずに減速できる(動き始めの速さが回転の速さに合う)", () => {
    const plan = planStop({ ...base, targetId: loop[3].id, position: 12 })!;
    const spinPerSec = base.speedPerFrame * 60;
    const startSpeed = ((plan.to - plan.from) / (plan.durationMs / 1000)) * plan.slope;
    expect(plan.slope).toBeLessThanOrEqual(3);
    if (plan.slope < 3) expect(startSpeed).toBeCloseTo(spinPerSec, 3);
    else expect(startSpeed).toBeGreaterThanOrEqual(spinPerSec - 1e-6);
  });

  it("曲線は、始まりが0・終わりが1で、途中で戻らず、終わりは止まる", () => {
    for (const slope of [0.3, 1, 2, 3]) {
      expect(easeStop(0, slope)).toBe(0);
      expect(easeStop(1, slope)).toBeCloseTo(1, 10);
      let prev = 0;
      for (let u = 0.01; u <= 1; u += 0.01) {
        const v = easeStop(u, slope);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = v;
      }
      // 終わり際の速さがほぼ0(減速して止まる)
      expect(easeStop(1, slope) - easeStop(0.999, slope)).toBeLessThan(0.0005);
      // 範囲外は端に丸める
      expect(easeStop(-1, slope)).toBe(0);
      expect(easeStop(2, slope)).toBeCloseTo(1, 10);
    }
  });

  it("positionAtStop: 時間とともに進み、終わりで終点に着き、後半ほど遅い", () => {
    const plan = planStop({ ...base, targetId: loop[5].id, position: 250 })!;
    const samples = [0, 0.25, 0.5, 0.75, 1].map((f) => positionAtStop(plan, plan.durationMs * f));
    expect(samples[0]).toBeCloseTo(plan.from, 6);
    expect(samples[4]).toBeCloseTo(plan.to, 6);
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    expect(samples[4] - samples[2]).toBeLessThan(samples[2] - samples[0]);
  });

  it("止める景品がループに無ければ null。空のループも null", () => {
    expect(planStop({ ...base, targetId: "zzz", position: 0 })).toBeNull();
    expect(planStop({ ...base, loop: [], targetId: "a", position: 0 })).toBeNull();
  });

  it("回転が止まっていて、いまの位置がちょうど止める景品でも壊れない(距離0、傾き0)", () => {
    const index = loop.findIndex((x) => x.id === loop[2].id);
    const plan = planStop({ ...base, speedPerFrame: 0, targetId: loop[2].id, position: index * itemHeight })!;
    expect(plan.slope).toBe(0);
    expect(positionAtStop(plan, 0)).toBe(plan.from);
  });

  it("止まる時間は、左のリールから順に少しずつ遅れる", () => {
    expect(stopDurationMs(0)).toBe(STOP_BASE_MS);
    expect(stopDurationMs(2)).toBe(STOP_BASE_MS + 2 * STOP_STAGGER_MS);
  });

  it("回転は速く(旧は 10px/フレーム @140px)、リールごとに少しずつ違う", () => {
    expect(spinSpeed(0, 140)).toBeGreaterThan(14);
    expect(spinSpeed(1, 140)).toBeGreaterThan(spinSpeed(0, 140));
    expect(spinSpeed(2, 140)).toBeGreaterThan(spinSpeed(1, 140));
  });
});

describe("computeSlotSize(窓の大きさからの寸法)", () => {
  /** 枠(縁・電球)を含む、スロット全体のおおよその寸法。 */
  const block = (s: ReturnType<typeof computeSlotSize>) => ({
    h: s.itemHeight * 3 + 6 + s.itemHeight * 0.1 + (s.font * 1.5 * 1.25 + 24) + s.padding * 2 + 12 + 32,
    w: 3 * (s.reelWidth + 6) + 2 * s.gap + s.padding * 2 + 12 + 32,
  });

  it("1920x1080: 全体の高さがルーレット(約860px)に近い 780〜860px で、文字も大きい", () => {
    const s = computeSlotSize(1920, 1080);
    expect(block(s).h).toBeGreaterThan(740);
    expect(block(s).h).toBeLessThan(860);
    expect(s.font).toBeGreaterThanOrEqual(58); // 旧: 48px
    expect(s.itemHeight).toBeGreaterThan(140); // 旧: 140px
  });

  it("1280x720: 画面の高さに比例して小さくなる", () => {
    const small = computeSlotSize(1280, 720);
    expect(block(small).h).toBeLessThan(720 * 0.8);
    expect(block(small).h).toBeGreaterThan(720 * 0.65);
    expect(small.font).toBeGreaterThanOrEqual(38);
  });

  it("横が狭い・縦長の画面でも、はみ出さない", () => {
    for (const [w, h] of [[1024, 768], [800, 1200], [600, 900], [390, 844], [320, 568], [280, 800]]) {
      const s = computeSlotSize(w, h);
      expect(block(s).w, `${w}x${h}`).toBeLessThanOrEqual(w);
      expect(block(s).h, `${w}x${h}`).toBeLessThanOrEqual(h);
    }
  });

  it("上限と下限がある。文字には下限がある", () => {
    expect(computeSlotSize(7680, 4320).itemHeight).toBe(260);
    const tiny = computeSlotSize(100, 100);
    expect(tiny.itemHeight).toBe(20);
    expect(tiny.font).toBeGreaterThanOrEqual(12);
  });
});
