import type { RouteRecordRaw } from "vue-router";

/**
 * 参加者がQRコードから開く回答画面(quiz-join)を、/execute配下ではなくトップレベルに
 * 登録するためのルート定義を返す。/execute配下に載せるとexecute-viewがスマホ側で
 * マウントされてしまうため、同じコンポーネントを別名で登録する。
 */
export function createStandaloneQuizJoinRoutes(
  gameRoutes: readonly RouteRecordRaw[]
): RouteRecordRaw[] {
  const joinRoute = gameRoutes.find((r) => r.name === "quiz-join");
  if (!joinRoute || !joinRoute.component) return [];
  return [
    {
      path: joinRoute.path,
      name: "quiz-join-standalone",
      component: joinRoute.component,
    },
  ];
}
