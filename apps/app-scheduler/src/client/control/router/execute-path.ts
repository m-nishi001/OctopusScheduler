import type { RouteRecordRaw } from "vue-router";

/**
 * ゲームの画面（`/jackpot-…` `/quiz-…` `/quiz/…`）は、実行画面（`/execute` の中）の子ルートとして登録されている。
 * 実行画面を表示したまま遷移できるよう、ゲームの画面へのパスは、どこから来ても `/execute` 付きに直す。
 * このルールはここ1か所だけ。画面のリンクも、ホストへの遠隔の画面遷移も、そのままゲームのパスを使える。
 */
const GAME_PATH = /^\/(?:jackpot|quiz)(?:-|\/)/;

/** ゲームの画面のパスなら `/execute` を付ける。それ以外はそのまま。 */
export function toExecutePath(path: string): string {
  return GAME_PATH.test(path) ? `/execute${path}` : path;
}

/**
 * ゲームの画面へのパス（`/jackpot-…` `/quiz-…` と、クイズの `/quiz/…`）を、`/execute` 付きへ振り替えるルート。
 * クエリ（`?demo=1` など）は引き継がれる。
 */
export const gamePathRedirectRoutes: RouteRecordRaw[] = [
  { path: "/:game(jackpot|quiz)-:rest(.*)", redirect: (to) => ({ path: toExecutePath(to.path) }) },
  { path: "/quiz/:rest(.*)", redirect: (to) => ({ path: toExecutePath(to.path) }) },
];
