/**
 * ジャックポットの実行スコープ。
 * - live: 本番。既存のストレージ(DrawResultData / PrizeDrawState)をそのまま使う。
 * - demo: 設定画面からの動作確認。抽選結果・確変状態を別ストアに分離し、本番を汚さない。
 *
 * 抽選結果と確変状態はブラウザのローカルストレージで完結するため、サーバ側の検証は不要。
 * `?demo=1` はUI上の切替であり、セキュリティ境界ではない。
 */
export type JackpotScope = "live" | "demo";

export const DEMO_QUERY_KEY = "demo";

let currentScope: JackpotScope = "live";

export function getJackpotScope(): JackpotScope {
  return currentScope;
}

export function setJackpotScope(scope: JackpotScope): void {
  currentScope = scope;
}

/** ルートのクエリからスコープを判定する。判定箇所はここだけ。 */
export function resolveJackpotScope(
  query: Record<string, unknown> | undefined
): JackpotScope {
  return query?.[DEMO_QUERY_KEY] === "1" ? "demo" : "live";
}

/** ストア名をスコープ別にする。live は既存名のままなのでデータ移行は不要。 */
export function scopedStoreName(base: string, scope: JackpotScope): string {
  return scope === "demo" ? `${base}:demo` : base;
}
