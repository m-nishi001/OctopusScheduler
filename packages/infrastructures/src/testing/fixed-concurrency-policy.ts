import type { IConcurrencyPolicy } from "../interfaces/concurrency-policy";

/**
 * テスト用の固定並列度ポリシー。kindによらず常に同じ上限を返す。
 */
export class FixedConcurrencyPolicy implements IConcurrencyPolicy {
  constructor(private readonly concurrency: number) {}

  maxConcurrency(_kind: string): number {
    return this.concurrency;
  }
}
