import { describe, expect, it } from "vitest";
import { RehearsalDrawStore } from "./rehearsal-draw-store";
import { DrawConflictError } from "../../model/errors";
import type { DrawResultDto } from "./dto/draw-result-dto";

const draw = (drawId: string, memberId: string, prizeId: string, isKakuhen = false): DrawResultDto => ({
  drawId,
  wonMember: { id: memberId, name: memberId },
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

  describe("skipWinner(不在の当選者を飛ばす)", () => {
    const member = (id: string) => ({ id, name: id });

    it("当選者を置き換え、元の当選者を除外し、公開されていない状態に戻す。景品・確変の回はそのまま", async () => {
      const s = new RehearsalDrawStore();
      await s.commit(draw("d1", "m1", "p1", true));
      await s.reveal("d1");
      await s.skipWinner("d1", member("m2"));
      expect(await s.excludedMemberIds()).toEqual(["m1"]);
      expect(await s.pending()).toMatchObject({ drawId: "d1", wonMember: { id: "m2" }, wonPrize: { id: "p1" }, isKakuhen: true });
      expect(await s.results()).toHaveLength(1);
    });

    it("同じ人への置き換えの再送は成功。新しい当選者がすでに当選・除外済み、抽選が無いときは矛盾", async () => {
      const s = new RehearsalDrawStore();
      await s.commit(draw("d1", "m1", "p1"));
      await s.reveal("d1");
      await s.commit(draw("d2", "m2", "p2"));
      await expect(s.skipWinner("d2", member("m1"))).rejects.toBeInstanceOf(DrawConflictError);
      await s.skipWinner("d2", member("m3"));
      await s.skipWinner("d2", member("m3"));
      await expect(s.skipWinner("d1", member("m2"))).rejects.toThrow(/外されています/);
      await expect(s.skipWinner("nope", member("m4"))).rejects.toBeInstanceOf(DrawConflictError);
      expect(await s.excludedMemberIds()).toEqual(["m2"]);
    });

    it("reset で除外も消える", async () => {
      const s = new RehearsalDrawStore();
      await s.commit(draw("d1", "m1", "p1"));
      await s.skipWinner("d1", member("m2"));
      await s.reset();
      expect(await s.excludedMemberIds()).toEqual([]);
    });
  });

});
