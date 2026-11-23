import { describe, expect, it } from "vitest";
import { nextPending, restorePlan } from "./unrevealed-draws";

const d = (drawId: string) => ({ drawId });

describe("restorePlan", () => {
  it("0件: 何も公開せず、演出し直すものも無い", () => {
    expect(restorePlan([])).toEqual({ revealFirst: [], resume: null });
  });
  it("1件: それを演出し直す", () => {
    expect(restorePlan([d("a")])).toEqual({ revealFirst: [], resume: d("a") });
  });
  it("複数: 古い分は公開(古い順)、最後の1件だけ演出し直す", () => {
    expect(restorePlan([d("a"), d("b"), d("c")])).toEqual({ revealFirst: [d("a"), d("b")], resume: d("c") });
  });
});

describe("nextPending", () => {
  it("演出中の抽選だけなら null", () => {
    expect(nextPending([d("a")], "a")).toBeNull();
    expect(nextPending([], "a")).toBeNull();
  });
  it("先読みで確定済みの次の抽選があれば、それを返す", () => {
    expect(nextPending([d("a"), d("b")], "a")).toEqual(d("b"));
  });
  it("演出中の抽選が無い(まだ何も出していない)ときは、一番古い未公開", () => {
    expect(nextPending([d("a"), d("b")], null)).toEqual(d("a"));
  });
  it("当選者を飛ばして演出中の抽選が未公開に戻っても、それは拾わず先読み分を拾う", () => {
    expect(nextPending([d("a"), d("b")], "a")).toEqual(d("b"));
  });
});
