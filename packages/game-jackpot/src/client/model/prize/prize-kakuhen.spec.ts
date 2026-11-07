import { describe, it, expect } from "vitest";
import { countKakuhenPrizes, isKakuhenPrize, normalizePrizeKakuhen } from "./prize-kakuhen";

describe("prize-kakuhen", () => {
  it("kakuhen が決まっていればそれに従う(素材があってもOFFはOFF)", () => {
    expect(isKakuhenPrize({ kakuhen: false, image2: "a.png" })).toBe(false);
    expect(isKakuhenPrize({ kakuhen: true })).toBe(true);
  });

  it("未設定の古い景品は、2枚目の素材のどれかがあればON", () => {
    expect(isKakuhenPrize({})).toBe(false);
    expect(isKakuhenPrize({ image2: "a.png" })).toBe(true);
    expect(isKakuhenPrize({ winningImage2: "a.png" })).toBe(true);
    expect(isKakuhenPrize({ bgm2: "a.mp3" })).toBe(true);
    expect(isKakuhenPrize({ image2: "" })).toBe(false);
  });

  it("normalizePrizeKakuhen は kakuhen を補い、素材は消さず、何度かけても同じ", () => {
    const old = { id: "p", name: "n", order: 1, image2: "a.png" };
    const once = normalizePrizeKakuhen(old);
    expect(once).toEqual({ ...old, kakuhen: true });
    expect(normalizePrizeKakuhen(once)).toBe(once);
    const plain: { id: string; kakuhen?: boolean } = { id: "q" };
    expect(normalizePrizeKakuhen(plain).kakuhen).toBe(false);
    const off = { id: "r", name: "n", order: 3, kakuhen: false, image2: "keep.png" };
    expect(normalizePrizeKakuhen(off)).toBe(off);
  });

  it("countKakuhenPrizes は ON の数を数える", () => {
    expect(countKakuhenPrizes([{ kakuhen: true }, { kakuhen: false }, { bgm2: "x" }, {}])).toBe(2);
  });
});
