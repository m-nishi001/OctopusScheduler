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

/**
 * デモ抽選(練習抽選)の画面か。スコープ(live/demo)とは別の軸: 本番の流れの途中にある練習で、本番(live)の接続の中にいても、
 * 抽選状態はメモリだけの専用の置き場に持ち、結果の記録・公開をしない。画面を開くときにルートから決める。
 */
let currentDemoDraw = false;

/** いま開いているのが、デモ抽選(練習抽選)の画面か。 */
export function isDemoDrawScreen(): boolean {
  return currentDemoDraw;
}

/** デモ抽選の画面かどうかを切り替える。画面を開くときにルートから決める。 */
export function setDemoDrawScreen(value: boolean): void {
  currentDemoDraw = value;
}

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
