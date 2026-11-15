import { describe, it, expect } from "vitest";
import { DEFAULT_PRIZE_STOP_SEC, clampPrizeStopSec, parseMemberStopSec, parsePrizeStopSec } from "./stop-sec";

describe("parsePrizeStopSec（保存された画面設定から止まるまでの秒数を取り出す）", () => {
  it("設定が無い・形が違う・値が無いときは既定の4秒", () => {
    expect(DEFAULT_PRIZE_STOP_SEC).toBe(4);
    for (const settings of [null, undefined, "x", 3, {}, { prizeStopSec: null }, { prizeStopSec: "abc" }, { prizeStopSec: NaN }, { prizeStopSec: {} }]) {
      expect(parsePrizeStopSec(settings)).toBe(4);
    }
  });

  it("保存された秒数を取り出す（数字の文字列も受ける）", () => {
    expect(parsePrizeStopSec({ prizeStopSec: 6 })).toBe(6);
    expect(parsePrizeStopSec({ prizeStopSec: "7" })).toBe(7);
    expect(parsePrizeStopSec({ prizeStopSec: 2.5 })).toBe(2.5);
  });

  it("2〜15秒に収め、0.5秒刻みに丸める", () => {
    expect(parsePrizeStopSec({ prizeStopSec: 0 })).toBe(2);
    expect(parsePrizeStopSec({ prizeStopSec: -5 })).toBe(2);
    expect(parsePrizeStopSec({ prizeStopSec: 99 })).toBe(15);
    expect(parsePrizeStopSec({ prizeStopSec: 3.3 })).toBe(3.5);
    expect(clampPrizeStopSec(Infinity)).toBe(4);
  });
});

describe("parseMemberStopSec（メンバー抽選の停止秒数。景品抽選とは別の設定）", () => {
  it("無い・形が違うときは既定(3.5秒)。景品抽選の設定には影響されない", () => {
    expect(parseMemberStopSec(null)).toBe(3.5);
    expect(parseMemberStopSec({ prizeStopSec: 9 })).toBe(3.5);
    expect(parseMemberStopSec({ memberStopSec: "abc" })).toBe(3.5);
  });

  it("指定した秒数を使い、2〜15秒・0.5秒刻みに収める", () => {
    expect(parseMemberStopSec({ memberStopSec: 6, prizeStopSec: 9 })).toBe(6);
    expect(parseMemberStopSec({ memberStopSec: 1 })).toBe(2);
    expect(parseMemberStopSec({ memberStopSec: 99 })).toBe(15);
    expect(parseMemberStopSec({ memberStopSec: 3.3 })).toBe(3.5);
  });
});
