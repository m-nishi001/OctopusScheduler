import { describe, expect, it } from "vitest";
import { pickRankWinners } from "./rank-winners";

const r = (member: string, rank?: number) => ({ wonMember: { id: member }, wonPrize: { rank } });

describe("pickRankWinners", () => {
  it("最もランクの高い景品の当選者が special、最も低い景品の当選者が lowest", () => {
    const out = pickRankWinners([r("a", 3), r("b", 5), r("c", 1), r("d", 2)]);
    expect(out.special).toEqual({ id: "b" });
    expect(out.lowest).toEqual({ id: "c" });
  });

  it("同じランクが複数あれば先に出た人", () => {
    const out = pickRankWinners([r("a", 5), r("b", 5), r("c", 1), r("d", 1)]);
    expect(out.special).toEqual({ id: "a" });
    expect(out.lowest).toEqual({ id: "c" });
  });

  it("ランク未設定は標準の3として扱う", () => {
    const out = pickRankWinners([r("a"), r("b", 4), r("c", 2)]);
    expect(out.special).toEqual({ id: "b" });
    expect(out.lowest).toEqual({ id: "c" });
  });

  it("景品のランクがすべて同じなら、どちらも付けない", () => {
    expect(pickRankWinners([r("a", 3), r("b"), r("c", 3)])).toEqual({});
  });

  it("当選者がいなければ何も付けない。当選者か景品が欠けた結果は数えない", () => {
    expect(pickRankWinners([])).toEqual({});
    expect(pickRankWinners([{ wonMember: null, wonPrize: { rank: 5 } }, { wonMember: { id: "x" }, wonPrize: null }])).toEqual({});
  });
});
