import { MemberDrawService } from "./member-draw-service";
import { PrizeDrawService } from "./prize-draw-service";
import { injectable, inject } from "tsyringe";
import { toMember } from "../../applications/member/dto/member-dto";
import { toPrize } from "../../applications/prize/dto/prize-dto";
import type { MemberDto } from "../../applications/member/dto/member-dto";
import type { PrizeDto } from "../../applications/prize/dto/prize-dto";
import type { DrawResult } from "./draw-result";
import type { Prize } from "../prize/prize";

@injectable()
export class DrawService {
  private memberDrawService: MemberDrawService;
  private prizeDrawService: PrizeDrawService;

  constructor(
    @inject(MemberDrawService) memberDrawService: MemberDrawService,
    @inject(PrizeDrawService) prizeDrawService: PrizeDrawService
  ) {
    this.memberDrawService = memberDrawService;
    this.prizeDrawService = prizeDrawService;
  }

  calculateKakuhenTimings(totalPrizes: number): number[] {
    // New kakuhen timing logic:
    // - Use center = floor(totalPrizes / 2) as the central index (1-based)
    // - If totalPrizes < 10: return a single timing at center
    // - Otherwise return three consecutive timings centered at center
    //   i.e. [center-1, center, center+1], clipped to [1..totalPrizes]
    if (totalPrizes <= 0) return [];
    const center = Math.floor(totalPrizes / 2) || 1; // ensure at least 1
    if (totalPrizes < 10) {
      // single kakuhen point
      const idx = Math.min(Math.max(center, 1), totalPrizes);
      return [idx];
    }
    const t1 = Math.max(1, center - 1);
    const t2 = Math.min(totalPrizes, center + 1);
    // ensure unique and sorted
    const timings = [t1, center, t2]
      .map((v) => Math.min(Math.max(v, 1), totalPrizes))
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b);
    return timings;
  }

  reservePrizes(state: number[], prizes: Prize[]): DrawResult[] {
    const reservedCount = state.length;
    // New selection logic:
    // - Extract top-2 highest rank and top-2 lowest rank
    // - From these up to 4 candidates, pick reservedCount items with constraints:
    //   * When reservedCount >= 3: pick reservedCount items (typically 3) from the pool
    //     but ensure at least one from high-group and at least one from low-group are included.
    //   * When reservedCount === 1 (small prize count case), pick one item from the combined pool
    // - Fallback to random unique picks if there are insufficient distinct candidates
    const sortedHigh = [...prizes].sort(
      (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
    );
    const sortedLow = [...sortedHigh].reverse();

    const topHigh = sortedHigh.slice(0, 2);
    const topLow = sortedLow.slice(0, 2);

    // Build a unique pool preserving identity
    const poolMap = new Map<string, Prize>();
    for (const p of topHigh) poolMap.set(p.id, p);
    for (const p of topLow) poolMap.set(p.id, p);
    const pool = Array.from(poolMap.values());

    const reservedPrizes: Prize[] = [];

    const pickRandomFrom = (arr: Prize[], excludeIds = new Set<string>()) => {
      const candidates = arr.filter((p) => !excludeIds.has(p.id));
      if (candidates.length === 0) return null;
      return candidates[Math.floor(Math.random() * candidates.length)];
    };

    if (reservedCount <= 0) {
      // nothing to reserve
    } else if (reservedCount === 1) {
      // small-prize case: pick one from pool or fallback to random prize
      const pick = pickRandomFrom(pool) || pickRandomFrom(prizes);
      if (pick) reservedPrizes.push(pick);
    } else {
      // reservedCount >= 2 (normally 3)
      // Try to ensure at least one from topHigh and one from topLow
      const chosenIds = new Set<string>();

      // pick one from topHigh if available
      const highPick = pickRandomFrom(topHigh);
      if (highPick) {
        reservedPrizes.push(highPick);
        chosenIds.add(highPick.id);
      }

      // pick one from topLow if available and not duplicate
      let lowPick = pickRandomFrom(topLow, chosenIds);
      if (!lowPick && topLow.length > 0) {
        // if topLow only contains already chosen item, try to pick another from pool
        lowPick = pickRandomFrom(pool, chosenIds);
      }
      if (lowPick) {
        reservedPrizes.push(lowPick);
        chosenIds.add(lowPick.id);
      }

      // fill remaining picks from pool first, then from all prizes
      while (reservedPrizes.length < reservedCount) {
        const pick = pickRandomFrom(prizes, chosenIds);
        if (!pick) break;
        reservedPrizes.push(pick);
        chosenIds.add(pick.id);
      }
    }
    return reservedPrizes.map((prize) => ({
      drawId: `reserved-${prize.id}-${Date.now()}`,
      wonMember: null,
      wonPrize: { ...prize },
      isKakuhen: false,
    }));
  }

  async executeDraw(opts: {
    prizes: PrizeDto[];
    members: MemberDto[];
  }): Promise<DrawResult> {
    const members = opts.members.map(toMember);
    const prizes = opts.prizes.map(toPrize);

    // Draw member
    const res = this.memberDrawService.drawMember(members, [], 0);
    const winnerMemberId = res?.winnerId ?? null;
    const winnerMember = members.find((m) => m.id === winnerMemberId)!;

    // Draw prize
    const prizeOpts = {
      prizes: prizes,
      assignedPrizeIds: [],
      member: winnerMember,
      dummyCount: 0,
    };
    const prizeResult = this.prizeDrawService.drawPrize(prizeOpts);
    const winnerPrizeId = prizeResult ? prizeResult.winnerPrizeId : null;
    const winnerPrize = winnerPrizeId
      ? prizes.find((p) => p.id === winnerPrizeId)!
      : null;

    const drawId = crypto.randomUUID();

    const drawResult: DrawResult = {
      drawId,
      wonMember: winnerMember,
      // clone prize to ensure stored object is a plain POJO
      wonPrize: winnerPrize ? { ...winnerPrize } : null,
      isKakuhen: false,
    };

    return drawResult;
  }
}
