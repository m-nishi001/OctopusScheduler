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
  /**
   * 抽選を実行し、メンバーと景品のペアを返す。
   * @param input メンバー、景品、確変変数
   * @returns ペアの配列
   */
  draw(input: DrawInput): DrawPair[] {
    const { members, prizes, variable } = input;

    // 景品の重みを確変変数で調整（負値にならないよう clamp）
    const adjustedPrizes = prizes.map((prize) => ({
      ...prize,
      weight: Math.max(0, this.adjustPrizeWeight(prize.weight, variable)),
    }));

    // メンバーの weight が不正な場合もあるため安全化（デフォルト1）
    const safeMembers = members.map((m) => ({
      ...m,
      weight:
        typeof (m as any).weight === "number"
          ? Math.max(0, (m as any).weight)
          : 1,
    }));

    // メンバーを重みでシャッフル
    const shuffledMembers = this.shuffleWithWeights(safeMembers);

    // 景品を重みでシャッフル
    const shuffledPrizes = this.shuffleWithWeights(adjustedPrizes);

    // ペアリング
    const count = Math.min(shuffledMembers.length, shuffledPrizes.length);
    const pairs: DrawPair[] = [];
    for (let i = 0; i < count; i++) {
      pairs.push({
        memberId: shuffledMembers[i].id,
        prizeId: shuffledPrizes[i].id,
      });
    }

    return pairs;
  }

  private adjustPrizeWeight(weight: number, variable: number): number {
    switch (variable) {
      case 1:
        return weight; // 通常
      case 2:
        return 11 - weight; // 逆転
      case 3:
        return 21 - 2 * weight; // より強い逆転 (例: 1->19, 10->1)
      default:
        return weight;
    }
  }

  private shuffleWithWeights<T extends { weight: number }>(items: T[]): T[] {
    const result: T[] = [];
    const pool = [...items];
    while (pool.length) {
      const selected = this.selectWeighted(pool);
      result.push(selected);
      const idx = pool.indexOf(selected);
      pool.splice(idx, 1);
    }
    return result;
  }

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
}
