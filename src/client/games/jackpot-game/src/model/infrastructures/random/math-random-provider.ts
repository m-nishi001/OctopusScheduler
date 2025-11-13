import { injectable } from "tsyringe";
import { RandomProvider } from "../../domains/common/random-provider";

@injectable()
export class MathRandomProvider implements RandomProvider {
  next(): number {
    return Math.random();
  }

  nextInt(max: number): number {
    if (max <= 0) return 0;
    return Math.floor(this.next() * max);
  }
}
