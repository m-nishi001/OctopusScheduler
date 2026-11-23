import type { RouteLocationNormalized, RouteRecordRaw } from "vue-router";

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

/** ホストの会場の画面に出すエントリー受付。クイズ・ジャックポットと同じく、イベントの進行中の画面。 */
const ENTRY_STAGE_PATH = /^\/event-entry(?:\/|$)/;

/** ゲームの画面(`/execute` 付きも付かないものも)と、エントリー受付の画面か。開始前の画面を覚える・戻すかどうかの境目。 */
export function isGameRoute(route: Pick<RouteLocationNormalized, "path">): boolean {
  return GAME_PATH.test(route.path.replace(/^\/execute(?=\/)/, "")) || ENTRY_STAGE_PATH.test(route.path);
}

/** ジャックポットのエンディングは /execute 配下に登録されている(振り替え前の /jackpot-ending も許す)。 */
const JACKPOT_ENDING_PATH = /^\/(?:execute\/)?jackpot-ending$/;

/** ゲームの終了画面(クイズの結果、ジャックポットのエンディング)。 */
export function isGameFinishRoute(route: Pick<RouteLocationNormalized, "path" | "name">): boolean {
  return route.name === "quiz-result" || JACKPOT_ENDING_PATH.test(route.path);
}
