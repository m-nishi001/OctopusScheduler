import { WeightedSelector } from "./weighted-selector";
import { injectable, inject } from "tsyringe";
import type { Prize } from "../prize/prize";
import type { Member } from "../member/member";
import { MathRandomProvider } from "../common/math-random-provider";
import { NoReservedPrizesError } from "../errors";

/** 確定済みの抽選のうち、景品の側だけ見る。 */
type WonPrizes = { wonPrize?: { id: string } | null }[];

/** 景品抽選。残っている景品から、景品の重みに応じて1つを選ぶ。 */
@injectable()
export class PrizeDrawService {
  private weightedSelector: WeightedSelector;
  private rand: MathRandomProvider;

  constructor(
    @inject(WeightedSelector) weightedSelector: WeightedSelector,
    @inject(MathRandomProvider) rand: MathRandomProvider
  ) {
    this.weightedSelector = weightedSelector;
    this.rand = rand;
  }

  private static wonIds(results: WonPrizes): Set<string> {
    return new Set(results.map((r) => r.wonPrize?.id).filter((id): id is string => !!id));
  }

  /**
   * 通常抽選で引いてよい景品。当選済みに加えて、確変のために取り置いた景品も除く。
   * 取り置いた景品を通常抽選で引くと、後の確変抽選で同じ景品が重複して当選してしまう。
   */
  getDrawablePrizes(prizes: Prize[], results: WonPrizes, reservedPrizeIds: readonly string[] = []): Prize[] {
    const held = PrizeDrawService.wonIds(results);
    for (const id of reservedPrizeIds) held.add(id);
    return prizes.filter((p) => !held.has(p.id));
  }

  /** 取り置いた景品のうち、まだ当選していないもの(確変で当てる景品の候補)。 */
  getUnusedReservedPrizes(prizes: Prize[], results: WonPrizes, reservedPrizeIds: readonly string[]): Prize[] {
    const won = PrizeDrawService.wonIds(results);
    return prizes.filter((p) => reservedPrizeIds.includes(p.id) && !won.has(p.id));
  }

  /** 候補から1つを選ぶ。空なら例外。 */
  selectRandomReserved<T>(reserved: T[]): T {
    if (!reserved || reserved.length === 0) throw new NoReservedPrizesError("No reserved prizes to select from");
    return reserved[this.rand.nextInt(reserved.length)];
  }

  /**
   * 当選していない景品(取り置きの景品も含む)。景品の残りの数え方はこれ1つ。
   * 確定済みの抽選は必ず当選者がいるので、結果に出てくる景品がそのまま「当選済み」。
   */
  getRemainingPrizes(prizes: Prize[], results: WonPrizes): Prize[] {
    const won = PrizeDrawService.wonIds(results);
    return prizes.filter((p) => !won.has(p.id));
  }

  pickRandomPrizeFrom(prizes: Prize[]): Prize | null {
    if (!prizes || prizes.length === 0) return null;
    return prizes[this.rand.nextInt(prizes.length)];
  }

  /**
   * Build dummy prize ids by excluding provided ids and then sampling up to requiredSize.
   */
  buildDummyPrizeIds(
    prizes: Prize[],
    excludedIds: Set<string | null | undefined>,
    requiredSize: number
  ): string[] {
    const dummyCandidates = prizes.filter((p) => !excludedIds.has(p.id));
    // shuffle using Fisher-Yates with provided random provider for determinism in tests
    const rand = this.rand;
    const arr = [...dummyCandidates];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rand.nextInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr.slice(0, requiredSize).map((p) => p.id);
  }

  /** 当選景品の他に、見せ用のダミー景品のIDを `count` 個選ぶ(足りなければ重複して埋める)。 */
  pickDummyPrizeIds(prizes: Prize[], winnerPrizeId: string, count: number): string[] {
    const dummyPool = prizes.map((p) => p.id).filter((id) => id !== winnerPrizeId);
    return this.getDummyPrize(dummyPool, count);
  }

  drawPrize(opts: {
    prizes: Prize[];
    assignedPrizeIds: string[];
    member: Member;
    dummyCount: number;
  }): { winnerPrizeId: string | null; dummyPrizeIds: string[] } | null {
    const { prizes, assignedPrizeIds } = opts;

    const available = prizes.filter((p) => !assignedPrizeIds.includes(p.id));
    if (available.length === 0) return null;

    const picked = this.weightedSelector.selectWeighted(available);
    return {
      winnerPrizeId: picked.id,
      dummyPrizeIds: this.pickDummyPrizeIds(prizes, picked.id, opts.dummyCount),
    };
  }

  /**
   * 次の抽選を確変にするか。確変にする順番(timings。1始まり)に、「確定済みの件数 + 1」回目が含まれるか。
   * 確定済みの件数はセッション全体の数(イベントを跨いで数える)。
   */
  isKakuhenTurn(committedCount: number, timings: readonly number[]): boolean {
    return timings.includes(committedCount + 1);
  }

  private getDummyPrize(poolIds: string[], count: number): string[] {
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
