import { describe, it, expect } from "vitest";
import { MemberDrawService } from "./member-draw-service";
import { MockRandom } from "./test-utils";

describe("MemberDrawService", () => {
  /**
   * drawMemberメソッドが候補者がいない場合にnullを返すことをテストする。
   * 期待値: nullが返される。
   */
  it("drawMember returns null when no candidates", () => {
    const rand = new MockRandom([0]);
    const svc = new MemberDrawService(
      { selectUniformRandom: (p: any) => p[0] } as any,
      rand as any
    );
    const members = [{ id: "m1" }];
    const drawResults = [{ wonMember: { id: "m1" } } as any];
    const res = svc.drawMember(members as any, drawResults as any, 1);
    expect(res).toBeNull();
  });

  /**
   * drawMemberメソッドが当選者とダミーIDを返すことをテストする。
   * 期待値: winnerIdが定義され、dummyIdsの長さが2で、dummyIdsにwinnerIdが含まれない。
   */
  it("drawMember returns a winner and dummy ids", () => {
    const rand = new MockRandom([0, 0.5, 0.2]);
    const svc = new MemberDrawService(
      { selectUniformRandom: (p: any) => p[0] } as any,
      rand as any
    );
    const members = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
    const drawResults: any[] = [];
    const out = svc.drawMember(members as any, drawResults as any, 2) as any;
    expect(out).toBeDefined();
    expect(out.winnerId).toBeDefined();
    expect(out.dummyIds.length).toBe(2);
    expect(out.dummyIds).not.toContain(out.winnerId);
  });

  /**
   * drawMemberはメンバーのrank(表示用ラベル)を一切参照せず、
   * WeightedSelector.selectUniformRandomにのみ委譲することをテストする。
   */
  it("delegates winner selection to selectUniformRandom regardless of member rank", () => {
    const rand = new MockRandom([0]);
    const selectUniformRandom = (p: any) => p[p.length - 1];
    const svc = new MemberDrawService(
      { selectUniformRandom } as any,
      rand as any
    );
    const members = [
      { id: "m1", rank: 1 },
      { id: "m2", rank: 10 },
    ];
    const out = svc.drawMember(members as any, [] as any, 0) as any;
    expect(out.winnerId).toBe("m2");
  });
});
