import { injectable } from "tsyringe";

@injectable()
export class MathRandomProvider {
  next(): number {
    return Math.random();
  }

  nextInt(max: number): number {
    if (max <= 0) return 0;
    return Math.floor(this.next() * max);
  }
}
