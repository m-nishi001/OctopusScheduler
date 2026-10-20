import { describe, expect, it } from "vitest";
import { pickStopTarget, StopTargetNotFoundError } from "./stop-target";

/** i 番目の位置が、中央(index 4)からどれだけ離れているか。 */
const distanceFrom = (center: number) => (i: number) => Math.abs(i - center);

describe("pickStopTarget", () => {
  const ids = ["a", "b", "c", "a", "b", "c", "a", "b", "c"]; // 同じ顔ぶれが3周

  it("止める参加者のうち、中央にいちばん近いコピーを選ぶ", () => {
    expect(pickStopTarget(ids, "a", distanceFrom(4))).toBe(3);
    expect(pickStopTarget(ids, "c", distanceFrom(4))).toBe(5);
    expect(pickStopTarget(ids, "b", distanceFrom(4))).toBe(4);
  });

  it("中央から等距離のコピーがあるときは、手前(先)のコピー", () => {
    expect(pickStopTarget(["x", "a", "x", "a", "x"], "a", distanceFrom(2))).toBe(1);
  });

  it("止める参加者が表示の中にいないときは、別の人で止めず、例外にする（乱数で選ばない）", () => {
    expect(() => pickStopTarget(ids, "zzz", distanceFrom(4))).toThrow(StopTargetNotFoundError);
    expect(() => pickStopTarget(ids, "zzz", distanceFrom(4))).toThrow("zzz");
  });

  it("参加者を指定しないときだけ、中央にいちばん近い位置で止める", () => {
    expect(pickStopTarget(ids, null, distanceFrom(4))).toBe(4);
    expect(pickStopTarget(ids, null, distanceFrom(7))).toBe(7);
  });

  it("表示が空で参加者も指定が無いときは -1、指定があれば例外", () => {
    expect(pickStopTarget([], null, distanceFrom(0))).toBe(-1);
    expect(() => pickStopTarget([], "a", distanceFrom(0))).toThrow(StopTargetNotFoundError);
  });
});
