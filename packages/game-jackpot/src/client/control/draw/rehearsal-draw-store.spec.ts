import { describe, expect, it } from "vitest";
import { RehearsalDrawStore } from "./rehearsal-draw-store";
import { DrawConflictError } from "../../model/errors";
import type { DrawResultDto } from "./dto/draw-result-dto";

const draw = (drawId: string, memberId: string, prizeId: string, isKakuhen = false): DrawResultDto => ({
  drawId,
  wonMember: { id: memberId, name: memberId, rank: 1 },
  wonPrize: { id: prizeId, name: prizeId, order: 1 },
  isKakuhen,
  createdAt: 1,
});

describe("RehearsalDrawStore(サーバーの commit と同じ検査)", () => {
  it("同じ人・同じ景品は二度確定できない。公開されていない別の抽選があれば確定できない", async () => {
    const s = new RehearsalDrawStore();
    await s.commit(draw("d1", "m1", "p1"));
    await expect(s.commit(draw("d2", "m2", "p2"))).rejects.toThrow(/公開されていない/);
    await s.reveal("d1");
    await expect(s.commit(draw("d2", "m1", "p2"))).rejects.toThrow(/すでに当選/);
    await expect(s.commit(draw("d2", "m2", "p1"))).rejects.toThrow(/当選済み/);
    await s.commit(draw("d2", "m2", "p2"));
    expect(await s.results()).toHaveLength(2);
  });

  it("同じ内容の再送は成功、同じ drawId で中身が違えば矛盾", async () => {
    const s = new RehearsalDrawStore();
    await s.commit(draw("d1", "m1", "p1"));
    await s.commit(draw("d1", "m1", "p1"));
    await expect(s.commit(draw("d1", "m2", "p1"))).rejects.toBeInstanceOf(DrawConflictError);
  });

  it("確変は取り置いた景品だけ、通常は取り置き以外だけ", async () => {
    const s = new RehearsalDrawStore();
    await s.ensurePlan([1], ["p9"]);
    await expect(s.commit(draw("d1", "m1", "p1", true))).rejects.toThrow(/取り置いた景品以外/);
    await expect(s.commit(draw("d1", "m1", "p9", false))).rejects.toThrow(/取り置いた/);
    await s.commit(draw("d1", "m1", "p9", true));
  });

  it("予定は最初のものが勝つ。reveal は何度でも、知らない drawId は矛盾。reset で空に戻る", async () => {
    const s = new RehearsalDrawStore();
    await s.ensurePlan([1], ["a"]);
    expect(await s.ensurePlan([2], ["b"])).toEqual({ kakuhenTimings: [1], reservedPrizeIds: ["a"] });
    await s.commit(draw("d1", "m1", "p1"));
    await s.reveal("d1");
    await s.reveal("d1");
    await expect(s.reveal("zzz")).rejects.toBeInstanceOf(DrawConflictError);
    await s.reset();
    expect(await s.results()).toEqual([]);
    expect(await s.plan()).toBeNull();
  });
});
