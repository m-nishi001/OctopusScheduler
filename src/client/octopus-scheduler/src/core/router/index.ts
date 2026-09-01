import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "presenters/content-deck/router";
import { HistoryService } from "@common-lib/google-apps-script/gas-history-service";
import octopusSchedulerRoutes from "ui/router";
import jackpotGameRoutes from "games/jackpot-game/core/router";
import cardGameRoutes from "games/card-game/router";
import quizGameRoutes from "games/quiz-game/core/router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    ...routes,
    // Redirect top-level game absolute paths to /execute/... so links resolve
    // (e.g. /jackpot-admin/... -> /execute/jackpot-admin/...). This prevents
    // "No match found for location" warnings when rendering links inside
    // the execute screen which uses game absolute paths.
    {
      path: "/:game(jackpot|card|quiz)-:subpath(.*)",
      redirect: (to) => ({ path: `/execute${to.path}` }),
    },
    ...octopusSchedulerRoutes.filter((r) => r.path !== "/execute"),
    {
      path: "/execute",
      component: octopusSchedulerRoutes.find((r) => r.path === "/execute")
        ?.component,
      children: (function () {
        // include any children that the octopusSchedulerRoutes defined for /execute
        const appExecuteRoute = octopusSchedulerRoutes.find(
          (r) => r.path === "/execute"
        );
        const appExecuteChildren =
          (appExecuteRoute && (appExecuteRoute as any).children) || [];
        return [
          // include app-defined children first (e.g. show-html, show-image, ...)
          ...appExecuteChildren.map((c: any) => ({ ...c })),
          ...jackpotGameRoutes.map((r) => ({ ...r, path: r.path.slice(1) })),
          ...cardGameRoutes.map((r) => ({ ...r, path: r.path.slice(1) })),
          ...quizGameRoutes.map((r) => ({ ...r, path: r.path.slice(1) })),
        ];
      })(),
    },
  ],
});

// ブラウザのURLの変更はHash値の変更であるため、これを定義済ルートとマッピングする
router.beforeEach((to, from, next) => {
  // If we're navigating from inside /execute and the target is a game absolute path
  // (e.g. `/jackpot-admin`, `/card-admin`, `/quiz-admin`), rewrite to be
  // under `/execute` so execute-view remains mounted.
  const isFromExecute = String(from.path || "").startsWith("/execute");
  const isTargetExecuteAlready = String(to.path || "").startsWith("/execute");
  // Match game-prefixed absolute paths. Adjust patterns here if other game prefixes exist.
  const gameAbsPathRE = /^\/(jackpot|card|quiz)(?:-|\/|$)/;

  if (
    isFromExecute &&
    !isTargetExecuteAlready &&
    gameAbsPathRE.test(String(to.path || ""))
  ) {
    const newPath = `/execute${to.path}`;
    next({ path: newPath });
    return;
  }

  next();
});

// 画面遷移が発生したらGoogle apps scriptの関数を通じてブラウザのURL（ハッシュ値）を変更する
router.afterEach((route) => {
  const hash = route.fullPath.slice(1);
  HistoryService.replace(null, undefined, hash);
});

// Google apps scriptのHistoryChangeHandlerを設定する
HistoryService.setChangeHandler((event) => {
  router.push({ path: `/${event.location.hash}` });
});

export default router;
