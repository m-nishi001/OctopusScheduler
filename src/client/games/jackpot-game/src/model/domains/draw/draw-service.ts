export interface DrawInput {
  members: { id: string; weight: number }[];
  prizes: { id: string; weight: number }[];
  variable: number; // 1-3
}

export interface DrawPair {
  memberId: string;
  prizeId: string;
}

export class DrawService {
  private selectWeighted<T extends { weight: number }>(pool: T[]): T {
    const total = pool.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    // total が 0 の場合（すべて weight が 0）には一様ランダムで選択
    if (total <= 0) {
      const idx = Math.floor(Math.random() * pool.length);
      return pool[idx];
    }
    let r = Math.random() * total;
    for (const item of pool) {
      const w = Math.max(0, item.weight);
      r -= w;
      if (r < 0) return item;
    }
    return pool[pool.length - 1];
  }

  // -----------------------------
  // High-level APIs required by spec
  // -----------------------------

  /**
   * Draw a single member winner and return dummy member ids for animation.
   * If all members have already been marked as winners (isWinner flag in input), returns winnerId=null
   */
  drawMember(opts: {
    members: { id: string; weight?: number; isWinner?: boolean }[];
    requestDummyCount: number;
  }): { winnerId: string | null; dummyIds: string[] } {
    const { members, requestDummyCount } = opts;
    // filter candidates that are not already winners
    const candidates = members.filter((m) => !m.isWinner);
    if (candidates.length === 0) {
      // no available winners - return null and still provide dummy ids (which may include winners)
      const dummyIds = this.getDummyMember(
        members.map((m) => m.id),
        requestDummyCount
      );
      return { winnerId: null, dummyIds };
    }

    // prepare weighted members (use provided weight or default 1)
    const weighted = candidates.map((m) => ({
      id: m.id,
      weight: typeof m.weight === "number" ? Math.max(0, m.weight) : 1,
    }));
    const winner = this.selectWeighted(weighted);

    // prepare dummy list from all members excluding the winner
    const dummyPool = members.map((m) => m.id).filter((id) => id !== winner.id);
    const dummyIds = this.getDummyMember(dummyPool, requestDummyCount);
    return { winnerId: winner.id, dummyIds };
  }

  private getDummyMember(poolIds: string[], count: number): string[] {
    // allow duplicates if pool smaller than count; shuffle and take
    const ids = [...poolIds];
    const res: string[] = [];
    while (res.length < count && ids.length > 0) {
      const idx = Math.floor(Math.random() * ids.length);
      res.push(ids[idx]);
      ids.splice(idx, 1);
    }
    // if still short, fill by random picks (allow repeats)
    while (res.length < count && poolIds.length > 0) {
      const idx = Math.floor(Math.random() * poolIds.length);
      res.push(poolIds[idx]);
    }
    return res;
  }

  /**
   * Draw a prize for a given member. Implements basic rules:
   * - Higher-ranked members can be made more likely to get higher-ranked prizes by prize weights provided by caller
   * - Returns one winner prize id and dummy prize ids for animation
   * - This function intentionally keeps logic deterministic/stateless; orchestration (確変, reservation) should be handled at application layer
   */
  drawPrize(opts: {
    prizes: {
      id: string;
      weight?: number;
      rank?: number;
      isReserved?: boolean;
      isAssigned?: boolean;
    }[];
    memberRank?: number;
    requestDummyCount: number;
    preferModeRank?: number | null;
  }): { winnerPrizeId: string | null; dummyPrizeIds: string[] } {
    const { prizes, memberRank, requestDummyCount } = opts;
    // available prizes: not assigned
    const available = prizes.filter((p) => !p.isAssigned);
    if (available.length === 0) {
      const dummy = this.getDummyPrize(
        prizes.map((p) => p.id),
        requestDummyCount
      );
      return { winnerPrizeId: null, dummyPrizeIds: dummy };
    }

    // compute prize weights, optionally influenced by memberRank
    const weighted = available.map((p) => {
      const base = typeof p.weight === "number" ? Math.max(0, p.weight) : 1;
      const rankFactor =
        typeof memberRank === "number" && typeof p.rank === "number"
          ? 1 + (memberRank - (p.rank || 0)) * 0.1
          : 1;
      const finalWeight = Math.max(0, base * rankFactor);
      return { id: p.id, weight: finalWeight };
    });

    const picked = this.selectWeighted(weighted);

    const dummyPool = prizes.map((p) => p.id).filter((id) => id !== picked.id);
    const dummyPrizeIds = this.getDummyPrize(dummyPool, requestDummyCount);
    return { winnerPrizeId: picked.id, dummyPrizeIds: dummyPrizeIds };
  }

  private getDummyPrize(poolIds: string[], count: number): string[] {
    // same approach as dummy member
    const ids = [...poolIds];
    const res: string[] = [];
    while (res.length < count && ids.length > 0) {
      const idx = Math.floor(Math.random() * ids.length);
      res.push(ids[idx]);
      ids.splice(idx, 1);
    }
    while (res.length < count && poolIds.length > 0) {
      const idx = Math.floor(Math.random() * poolIds.length);
      res.push(poolIds[idx]);
    }
    return res;
  }
}
