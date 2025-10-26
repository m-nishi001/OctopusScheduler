export interface DrawInput {
  members: { id: string; weight: number; rank?: number }[];
  prizes: { id: string; weight: number; rank?: number }[];
  variable: number; // 1-3
}

export interface DrawPair {
  memberId: string;
  prizeId: string;
}

export class DrawService {
  private selectWeighted<T extends { weight: number }>(pool: T[]): T {
    const total = pool.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
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

  private shuffleWithWeights<T extends { weight: number }>(items: T[]): T[] {
    const result: T[] = [];
    const pool = [...items];
    while (pool.length > 0) {
      const selected = this.selectWeighted(pool);
      result.push(selected);
      pool.splice(pool.indexOf(selected), 1);
    }
    return result;
  }

  private adjustPrizeWeight(weight: number, variable: number): number {
    switch (variable) {
      case 1:
        return weight; // 通常
      case 2:
        return 11 - weight; // 逆転
      case 3:
        return 21 - 2 * weight; // 強い逆転
      default:
        return weight;
    }
  }

  // High-level API for full draw
  draw(input: DrawInput): DrawPair[] {
    const { members, prizes, variable } = input;
    const adjustedPrizes = prizes.map((p) => ({
      ...p,
      weight: this.adjustPrizeWeight(p.weight, variable),
    }));
    const shuffledMembers = this.shuffleWithWeights(members);
    const shuffledPrizes = this.shuffleWithWeights(adjustedPrizes);
    const minLength = Math.min(shuffledMembers.length, shuffledPrizes.length);
    return shuffledMembers.slice(0, minLength).map((member, i) => ({
      memberId: member.id,
      prizeId: shuffledPrizes[i].id,
    }));
  }

  // UI-required APIs
  drawMember(opts: {
    members: {
      id: string;
      rank: number;
      isWinner: boolean;
    }[];
    requestDummyCount: number;
  }): { winnerId: string | null; dummyIds: string[] } {
    const { members, requestDummyCount } = opts;
    const candidates = members.filter((m) => !m.isWinner);
    if (candidates.length === 0) {
      return {
        winnerId: null,
        dummyIds: this.getDummyMember(
          members.map((m) => m.id),
          requestDummyCount
        ),
      };
    }
    const weighted = candidates.map((m) => ({
      id: m.id,
      weight: 1,
    }));
    const winner = this.selectWeighted(weighted);
    const dummyPool = members.map((m) => m.id).filter((id) => id !== winner.id);
    return {
      winnerId: winner.id,
      dummyIds: this.getDummyMember(dummyPool, requestDummyCount),
    };
  }

  private getDummyMember(poolIds: string[], count: number): string[] {
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

  drawPrize(opts: {
    prizes: {
      id: string;
      weight: number;
      rank?: number;
      isAssigned?: boolean;
    }[];
    memberRank?: number;
    requestDummyCount: number;
    preferModeRank?: number | null;
  }): { winnerPrizeId: string | null; dummyPrizeIds: string[] } {
    const { prizes, memberRank, requestDummyCount } = opts;
    const available = prizes.filter((p) => !p.isAssigned);
    if (available.length === 0) {
      return {
        winnerPrizeId: null,
        dummyPrizeIds: this.getDummyPrize(
          prizes.map((p) => p.id),
          requestDummyCount
        ),
      };
    }
    const weighted = available.map((p) => {
      const base = p.weight;
      const rankFactor =
        memberRank && p.rank ? 1 + (memberRank - p.rank) * 0.1 : 1;
      return { id: p.id, weight: Math.max(0, base * rankFactor) };
    });
    const picked = this.selectWeighted(weighted);
    const dummyPool = prizes.map((p) => p.id).filter((id) => id !== picked.id);
    return {
      winnerPrizeId: picked.id,
      dummyPrizeIds: this.getDummyPrize(dummyPool, requestDummyCount),
    };
  }

  private getDummyPrize(poolIds: string[], count: number): string[] {
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

  getLastPrizeCount(prizes: { isAssigned?: boolean }[]): {
    total: number;
    remaining: number;
  } {
    const total = prizes.length;
    const remaining = prizes.filter((p) => !p.isAssigned).length;
    return { total, remaining };
  }
}
