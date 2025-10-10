import { injectable } from "tsyringe";

export interface DrawInput {
  members: { id: string; weight: number }[];
  prizes: { id: string; weight: number }[];
  variable: number; // 1-3
}

export interface DrawPair {
  memberId: string;
  prizeId: string;
}

@injectable()
export class DrawService {
  /**
   * 抽選を実行し、メンバーと景品のペアを返す。
   * @param input メンバー、景品、確変変数
   * @returns ペアの配列
   */
  draw(input: DrawInput): DrawPair[] {
    const { members, prizes, variable } = input;

    // 景品の重みを確変変数で調整
    const adjustedPrizes = prizes.map((prize) => ({
      ...prize,
      weight: this.adjustPrizeWeight(prize.weight, variable),
    }));

    // メンバーを重みでシャッフル
    const shuffledMembers = this.shuffleWithWeights(members);

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
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * total;
    for (const item of pool) {
      r -= item.weight;
      if (r < 0) return item;
    }
    return pool[pool.length - 1];
  }
}
