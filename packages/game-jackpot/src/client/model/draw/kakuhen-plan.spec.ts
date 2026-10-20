import { describe, it, expect } from "vitest";
import { AUTO_KAKUHEN_PLAN, parseKakuhenPlan, parseTimingsText, usableKakuhenTimings } from "./kakuhen-plan";
import { PrizeReservationService } from "./prize-reservation-service";
import { MockRandom } from "./test-utils";

describe("parseKakuhenPlan（保存された画面設定から計画を取り出す）", () => {
  it("設定が無い・形が違うときは、おまかせ", () => {
    expect(parseKakuhenPlan(null)).toEqual(AUTO_KAKUHEN_PLAN);
    expect(parseKakuhenPlan(undefined)).toEqual(AUTO_KAKUHEN_PLAN);
    expect(parseKakuhenPlan("x")).toEqual(AUTO_KAKUHEN_PLAN);
    expect(parseKakuhenPlan({})).toEqual(AUTO_KAKUHEN_PLAN);
  });

  it("以前の設定の値 random は、おまかせとして扱う（指定した回は無視する）", () => {
    expect(parseKakuhenPlan({ kakuhenMode: "random", kakuhenFixedTimings: [3] })).toEqual(AUTO_KAKUHEN_PLAN);
  });

  it("fixed なら指定した回を取り出す。整数でない値は捨てる", () => {
    expect(parseKakuhenPlan({ kakuhenMode: "fixed", kakuhenFixedTimings: [3, 7, 0, -1, 2.5, "x"] })).toEqual({
      mode: "fixed",
      fixedTimings: [3, 7],
    });
  });

  it("fixed で回が配列でない・無いときは、確変なし（空）", () => {
    expect(parseKakuhenPlan({ kakuhenMode: "fixed" })).toEqual({ mode: "fixed", fixedTimings: [] });
    expect(parseKakuhenPlan({ kakuhenMode: "fixed", kakuhenFixedTimings: "3,7" })).toEqual({ mode: "fixed", fixedTimings: [] });
  });
});

describe("parseTimingsText（入力欄の文字を回の一覧にする）", () => {
  it("カンマ・読点・空白区切りで読み、小さい順・重複なしにする", () => {
    expect(parseTimingsText("7, 3,3、5  9")).toEqual([3, 5, 7, 9]);
  });

  it("数字以外・0・負の値・小数は取り除く。空は空", () => {
    expect(parseTimingsText("a, 0, -2, 1.5, 4")).toEqual([4]);
    expect(parseTimingsText("")).toEqual([]);
    expect(parseTimingsText("  ,, ")).toEqual([]);
  });
});

describe("usableKakuhenTimings（景品の数に収める）", () => {
  it("景品の数を超える回は除く。通常の抽選用に最低1件を残すので、最大で景品数-1回", () => {
    expect(usableKakuhenTimings([2, 4, 9], 5)).toEqual([2, 4]);
    expect(usableKakuhenTimings([1, 2, 3, 4, 5], 5)).toEqual([1, 2, 3, 4]);
    expect(usableKakuhenTimings([1], 1)).toEqual([]);
    expect(usableKakuhenTimings([1], 0)).toEqual([]);
  });

  it("重複は1回にまとめ、小さい順にする", () => {
    expect(usableKakuhenTimings([4, 2, 2, 4], 10)).toEqual([2, 4]);
  });
});

describe("PrizeReservationService.calculateKakuhenTimings（計画に従う）", () => {
  const service = new PrizeReservationService(new MockRandom([0]) as never);

  it("計画を渡さなければ、これまでどおり（景品の真ん中あたりで続けて2回）", () => {
    expect(service.calculateKakuhenTimings(10)).toEqual([5, 6]);
    expect(service.calculateKakuhenTimings(10, AUTO_KAKUHEN_PLAN)).toEqual([5, 6]);
  });

  it("fixed なら指定した回（景品の数に収めて）", () => {
    expect(service.calculateKakuhenTimings(10, { mode: "fixed", fixedTimings: [3, 7] })).toEqual([3, 7]);
    expect(service.calculateKakuhenTimings(5, { mode: "fixed", fixedTimings: [3, 7] })).toEqual([3]);
  });

  it("fixed で空なら確変なし", () => {
    expect(service.calculateKakuhenTimings(10, { mode: "fixed", fixedTimings: [] })).toEqual([]);
  });
});
