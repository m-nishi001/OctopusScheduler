import { describe, it, expect, vi } from "vitest";
import { buildPrizesToPrepare, performNext, performResume } from "./perform-draw";

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

const drawn = (over: Record<string, unknown> = {}): any => ({
  kind: "drawn",
  progress: {},
  outcome: {
    result: { drawId: "d", wonPrize: { id: "p2" }, wonMember: { id: "m" } },
    prizeRes: prizeRes({ winnerPrizeId: "p2" }),
    memberRes: { winnerId: "m" },
    ...over,
  },
});

describe("performNext", () => {
  const deps = (drawNext: any) => ({
    drawService: { drawNext, resumeDraw: vi.fn() },
    prizes: { value: prizes },
    buildPrizeItems: vi.fn().mockResolvedValue([{ id: "item" }]),
  });

  it("抽選結果の当選景品を、景品一覧の完全な情報に置き換え、ルーレットの材料を添えて返す(画面には反映しない)", async () => {
    const d = deps(vi.fn().mockResolvedValue(drawn()));

    const next = await performNext(d);

    expect(next.kind).toBe("draw");
    if (next.kind !== "draw") return;
    expect(next.outcome.winner).toBe(prizes[1]);
    expect(next.outcome.result.wonPrize).toBe(prizes[1]);
    expect(next.outcome.prizeItems).toEqual([{ id: "item" }]);
    expect(d.buildPrizeItems).toHaveBeenCalledTimes(1);
  });

  it("終了なら、抽選もルーレットの材料の用意もせずに終了を返す", async () => {
    const finished = { kind: "finished", progress: { endReason: "prizes" } };
    const d = deps(vi.fn().mockResolvedValue(finished));
    expect(await performNext(d)).toBe(finished);
    expect(d.buildPrizeItems).not.toHaveBeenCalled();
  });

  it("抽選サービスが失敗したら、そのまま例外にする(中途半端な結果を返さない)", async () => {
    const d = deps(vi.fn().mockRejectedValue(new Error("対象のメンバーがいません")));
    await expect(performNext(d)).rejects.toThrow("対象のメンバーがいません");
    expect(d.buildPrizeItems).not.toHaveBeenCalled();
  });

  it("当選景品が景品一覧に無いとき、null 参照ではなく原因の分かるエラーにする", async () => {
    const d = deps(vi.fn().mockResolvedValue(drawn({ result: { wonPrize: { id: "ghost" } }, prizeRes: prizeRes() })));
    await expect(performNext(d)).rejects.toThrow("当選した景品が景品一覧に見つかりません");
  });
});

describe("performResume", () => {
  it("引き直さず、確定済みの結果の材料でルーレットを用意する", async () => {
    const resumeDraw = vi.fn().mockResolvedValue(drawn().outcome);
    const drawNext = vi.fn();
    const buildPrizeItems = vi.fn().mockResolvedValue([]);
    const pending: any = { drawId: "d", wonPrize: { id: "p2" }, wonMember: { id: "m" } };

    const out = await performResume({ drawService: { drawNext, resumeDraw }, prizes: { value: prizes }, buildPrizeItems }, pending);

    expect(drawNext).not.toHaveBeenCalled();
    expect(resumeDraw).toHaveBeenCalledWith(pending, expect.anything());
    expect(out.winner).toBe(prizes[1]);
    expect(buildPrizeItems).toHaveBeenCalledTimes(1);
  });
});
