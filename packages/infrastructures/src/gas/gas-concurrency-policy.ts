/**
 * IConcurrencyPolicy の GAS 実装。
 *
 * `google.script.run` は同時に呼び出せる回数に制限があり、既存の
 * per-file 同期実装(例: AssetRepository.syncAssets)は実測でこの制限に
 * 収まるよう concurrency=6 を採用していた。それをファイル単位の同期対象
 * (アセットなど)の標準値として使い、それ以外(1回のリクエストで完結する
 * JSON ブロブ全体の同期対象)は既定値を使う。
 */
import { injectable } from "tsyringe";
import type { IConcurrencyPolicy } from "../interfaces/concurrency-policy";

const ASSET_LIKE_CONCURRENCY = 6;
const DEFAULT_CONCURRENCY = 4;

@injectable()
export class GasConcurrencyPolicy implements IConcurrencyPolicy {
  maxConcurrency(kind: string): number {
    switch (kind) {
      case "asset":
      case "quiz-asset":
        return ASSET_LIKE_CONCURRENCY;
      default:
        return DEFAULT_CONCURRENCY;
    }
  }
}

/**
 * `@octopus/infrastructures/platform-concurrency-policy` 経由で解決される際の
 * 中立な名前。Cloudflare実装(cloudflare-concurrency-policy.ts)も同名でexportし、
 * 呼び出し側はビルド対象(GAS/Cloudflare)を意識せず同じ識別子で参照できる。
 */
export { GasConcurrencyPolicy as PlatformConcurrencyPolicy };
