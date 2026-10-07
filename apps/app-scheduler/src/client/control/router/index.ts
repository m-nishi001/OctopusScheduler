import {
  createRouter,
  createWebHashHistory,
  START_LOCATION,
} from "vue-router";
import { HistoryService } from "@octopus/client-common/google-apps-script/gas-history-service";
import octopusSchedulerRoutes from "../../ui/router";
import { jackpotGameRoutes } from "@octopus/game-jackpot";
import { cardGameRoutes } from "@octopus/game-card";
import { quizGameRoutes } from "@octopus/game-quiz";
import { createStandaloneQuizJoinRoutes } from "./quiz-join-route";
import { hashToPath } from "./initial-hash";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // Redirect top-level game absolute paths to /execute/... so links resolve
    // (e.g. /jackpot-admin/... -> /execute/jackpot-admin/...). This prevents
    // "No match found for location" warnings when rendering links inside
    // the execute screen which uses game absolute paths.
    {
      path: "/:game(jackpot|card|quiz)-:subpath(.*)",
      redirect: (to) => ({ path: `/execute${to.path}` }),
    },
    ...createStandaloneQuizJoinRoutes(quizGameRoutes),
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
// GASではiframe内のURLにハッシュが現れないため、最初の遷移に限り、公式APIで取得した
// 外側URLの初期ハッシュ(QRコードのURL等)からルートを復元する。
// "/" は "/home" にリダイレクトされた後にガードへ届くため、遷移先の中身では判定しない。
let initialHashHandled = false;
router.beforeEach(async (_to, from) => {
  if (initialHashHandled || from !== START_LOCATION) return;
  initialHashHandled = true;
  const path = hashToPath(await HistoryService.getInitialHash());
  if (path) return { path, replace: true };
});

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
