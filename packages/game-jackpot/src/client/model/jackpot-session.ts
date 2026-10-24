/**
 * ジャックポットの実行スコープ。
 * - live: 本番。セッションのホストとして接続していれば、抽選状態はセッションの結果ファイル(サーバー)に残る。
 * - demo: リハーサル。抽選状態はメモリだけに持ち、サーバーにも本番にも残さない。
 *
 * 接続が無い(セッションの外で動かしている)ときは、live でもメモリだけのリハーサルになる(DrawStoreProvider)。
 * `?demo=1` はUI上の切替であり、セキュリティ境界ではない。
 */
export type JackpotScope = "live" | "demo";

export const DEMO_QUERY_KEY = "demo";

let currentScope: JackpotScope = "live";

/** いまの実行スコープ(本番 / デモ)。 */
export function getJackpotScope(): JackpotScope {
  return currentScope;
}

/** 実行スコープ(本番 / デモ)を切り替える。画面を開くときにルートのクエリから決める。 */
export function setJackpotScope(scope: JackpotScope): void {
  currentScope = scope;
}

/** ルートのクエリからスコープを判定する。判定箇所はここだけ。 */
export function resolveJackpotScope(
  query: Record<string, unknown> | undefined
): JackpotScope {
  return query?.[DEMO_QUERY_KEY] === "1" ? "demo" : "live";
}
