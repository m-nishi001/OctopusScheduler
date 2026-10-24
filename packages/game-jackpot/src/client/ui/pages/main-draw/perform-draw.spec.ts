import { describe, it, expect, vi } from "vitest";
import { buildPrizesToPrepare, performDraw, performResume } from "./perform-draw";

const prizes: any[] = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
const prizeRes = (over: Record<string, unknown> = {}): any => ({
  winnerPrizeId: "p1",
  dummyWinnerPrizeId: null,
  dummyPrizeIds: [],
  drawId: "d",
  ...over,
});

describe("buildPrizesToPrepare", () => {
  it("当選景品、ダミー当選、ダミー景品の順に並べる。ダミーは一意なIDの複製で、元のIDを残す", () => {
    const shown = buildPrizesToPrepare(prizes, prizeRes({ dummyWinnerPrizeId: "p2", dummyPrizeIds: ["p3", "p3"] }));

    expect(shown.map((p) => p.id)).toEqual(["p1", "p2#dummy-winner", "p3#dup-0", "p3#dup-1"]);
    expect(shown[1]).toMatchObject({ originalPrizeId: "p2" });
    expect(shown[3]).toMatchObject({ originalPrizeId: "p3" });
  });

  it("ダミー当選が当選景品と同じなら重ねない。景品一覧に無いIDは無視する", () => {
    const shown = buildPrizesToPrepare(prizes, prizeRes({ dummyWinnerPrizeId: "p1", dummyPrizeIds: ["zzz"] }));
    expect(shown.map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("performDraw", () => {
  const deps = (executeDraw: any) => ({
    drawService: { executeDraw, resumeDraw: executeDraw },
    prizes: { value: prizes },
    preparePrizes: vi.fn().mockResolvedValue([]),
  });

  it("抽選結果の当選景品を、景品一覧の完全な情報に置き換えて返す", async () => {
    const d = deps(
      vi.fn().mockResolvedValue({
        result: { wonPrize: { id: "p2" }, wonMember: { id: "m" } },
        prizeRes: prizeRes({ winnerPrizeId: "p2" }),
        memberRes: { winnerId: "m" },
      })
    );

    const out = await performDraw(d);

    expect(out.winner).toBe(prizes[1]);
    expect(out.result.wonPrize).toBe(prizes[1]);
    expect(d.preparePrizes).toHaveBeenCalledTimes(1);
  });

  it("抽選サービスが失敗したら、そのまま例外にする(中途半端な結果を返さない)", async () => {
    const d = deps(vi.fn().mockRejectedValue(new Error("対象のメンバーがいません")));
    await expect(performDraw(d)).rejects.toThrow("対象のメンバーがいません");
    expect(d.preparePrizes).not.toHaveBeenCalled();
  });

  it("当選景品が景品一覧に無いとき、null 参照ではなく原因の分かるエラーにする", async () => {
    const d = deps(
      vi.fn().mockResolvedValue({ result: { wonPrize: { id: "ghost" } }, prizeRes: prizeRes(), memberRes: {} })
    );
    await expect(performDraw(d)).rejects.toThrow("当選した景品が景品一覧に見つかりません");
  });
});

describe("performResume", () => {
  it("引き直さず、確定済みの結果の材料でルーレットを用意する", async () => {
    const resumeDraw = vi.fn().mockResolvedValue({
      result: { drawId: "d", wonPrize: { id: "p2" }, wonMember: { id: "m" } },
      prizeRes: prizeRes({ winnerPrizeId: "p2" }),
      memberRes: { winnerId: "m" },
    });
    const executeDraw = vi.fn();
    const preparePrizes = vi.fn().mockResolvedValue([]);
    const pending: any = { drawId: "d", wonPrize: { id: "p2" }, wonMember: { id: "m" } };

    const out = await performResume({ drawService: { executeDraw, resumeDraw }, prizes: { value: prizes }, preparePrizes }, pending);

    expect(executeDraw).not.toHaveBeenCalled();
    expect(resumeDraw).toHaveBeenCalledWith(pending, expect.anything());
    expect(out.winner).toBe(prizes[1]);
    expect(preparePrizes).toHaveBeenCalledTimes(1);
  });
});
