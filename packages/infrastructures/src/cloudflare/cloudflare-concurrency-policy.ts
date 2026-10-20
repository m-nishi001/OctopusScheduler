/**
 * IConcurrencyPolicy の Cloudflare 実装。
 *
 * Cloudflare Workers への通信はブラウザの `fetch` によるものであり、GAS の
 * `google.script.run` のような同時実行数の制限がないため、GAS版より大幅に
 * 高い上限を返し、ブラウザ側の並列度を最大限活かせるようにする。
 */
import { injectable } from "tsyringe";
import type { IConcurrencyPolicy } from "../interfaces/concurrency-policy";

const HIGH_CONCURRENCY = 32;

/** `IConcurrencyPolicy` の Cloudflare 実装。GAS のような同時実行数の制限が無いので、高い上限(32)を返す。 */
@injectable()
export class CloudflareConcurrencyPolicy implements IConcurrencyPolicy {
  maxConcurrency(_kind: string): number {
    return HIGH_CONCURRENCY;
  }
}

/**
 * `@octopus/infrastructures/platform-concurrency-policy` 経由で解決される際の
 * 中立な名前。GAS実装(gas-concurrency-policy.ts)と対になる。
 */
export { CloudflareConcurrencyPolicy as PlatformConcurrencyPolicy };
