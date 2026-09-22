import "reflect-metadata";

/**
 * Simple deterministic mock RandomProvider for tests.
 * next() will cycle through provided values (or return 0) and nextInt uses floor(next()*max).
 */
export class MockRandom {
  private vals: number[];
  private idx = 0;

  constructor(vals: number[] = []) {
    this.vals = vals.length > 0 ? vals : [0];
  }

  next(): number {
    const v = this.vals[this.idx % this.vals.length];
    this.idx++;
    return v;
  }

  nextInt(max: number): number {
    if (max <= 0) return 0;
    return Math.floor(this.next() * max);
  }
}
