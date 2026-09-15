import { injectable } from "tsyringe";
import { RandomProvider } from "../../domains/common/random-provider";

/**
 * FixedRandomProvider is useful for deterministic tests.
 * Provide either a seed array of numbers in [0,1) to be returned in sequence,
 * or a single value to be reused.
 */
@injectable()
export class FixedRandomProvider implements RandomProvider {
  private values: number[];
  private idx = 0;

  constructor(values: number[] = [0.5]) {
    this.values = values.length ? values : [0.5];
  }

  next(): number {
    const v = this.values[this.idx % this.values.length];
    this.idx += 1;
    return Math.min(Math.max(v, 0), 0.999999999);
  }

  nextInt(max: number): number {
    if (max <= 0) return 0;
    return Math.floor(this.next() * max);
  }
}
