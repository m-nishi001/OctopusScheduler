export class WeightedSelector {
  selectWeighted<T extends { weight: number }>(pool: T[]): T {
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

  shuffleWithWeights<T extends { weight: number }>(items: T[]): T[] {
    const result: T[] = [];
    const pool = [...items];
    while (pool.length > 0) {
      const selected = this.selectWeighted(pool);
      result.push(selected);
      pool.splice(pool.indexOf(selected), 1);
    }
    return result;
  }
}
