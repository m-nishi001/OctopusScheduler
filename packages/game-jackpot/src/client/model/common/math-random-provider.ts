import { injectable } from "tsyringe";

/** 乱数の供給元。抽選のテストで固定の乱数に差し替えられるよう、`Math.random` を直接呼ばずここを通す。 */
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
