import { WeightedSelector } from "./weighted-selector";
import type { DrawResult } from "./draw-result";
import type { Member } from "../member/member";
import { injectable, inject } from "tsyringe";
import { MathRandomProvider } from "../common/math-random-provider";

/** メンバー抽選。当選済み・飛ばした(不在で外した)人を除いた候補から、メンバーの重みに応じて1人を選ぶ。 */
@injectable()
export class MemberDrawService {
  private weightedSelector: WeightedSelector;
  private rand: MathRandomProvider;

  constructor(
    @inject(WeightedSelector) weightedSelector: WeightedSelector,
    @inject(MathRandomProvider) rand: MathRandomProvider
  ) {
    this.weightedSelector = weightedSelector;
    this.rand = rand;
  }

  /**
   * 当選者を1人選ぶ。まだ当選しておらず、飛ばされてもいない(excludedMemberIds)人の中から、`weight`（当選しやすさ）に比例した確率で選ぶ
   * （全員が無指定・同じ値なら均等）。ダミー（リールに流す他の人）は、飛ばされた人を除いて重みに関係なく選ぶ。
   * 候補がいなければ null。
   */
  drawMember(
    members: Member[],
    drawResults: DrawResult[],
    dummyCount: number,
    excludedMemberIds: readonly string[]
  ): { winnerId: string | null; dummyIds: string[] } | null {
    const present = members.filter((m) => !excludedMemberIds.includes(m.id));
    const candidates = present.filter(
      (m) => !drawResults.some((dr) => dr.wonMember?.id === m.id)
    );
    if (candidates.length === 0) {
      return null;
    }
    const winner = this.weightedSelector.selectWeighted(candidates);
    return {
      winnerId: winner.id,
      dummyIds: this.pickDummyMemberIds(present, winner.id, dummyCount),
    };
  }

  /** 当選者の他に、リールに流す見せ用のメンバーのIDを `count` 人選ぶ(重みに関係なく。足りなければ重複して埋める)。 */
  pickDummyMemberIds(members: Member[], winnerId: string, count: number): string[] {
    const dummyPool = members.map((m) => m.id).filter((id) => id !== winnerId);
    return this.getDummyMember(dummyPool, count);
  }

  private getDummyMember(poolIds: string[], count: number): string[] {
    const ids = [...poolIds];
    const res: string[] = [];
    const rand = this.rand;
    while (res.length < count && ids.length > 0) {
      const idx = rand.nextInt(ids.length);
      res.push(ids[idx]);
      ids.splice(idx, 1);
    }
    while (res.length < count && poolIds.length > 0) {
      const idx = rand.nextInt(poolIds.length);
      res.push(poolIds[idx]);
    }
    return res;
  }
}
