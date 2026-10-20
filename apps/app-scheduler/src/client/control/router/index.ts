import {
  createRouter,
  createWebHashHistory,
  START_LOCATION,
  type RouteRecordSingleView,
} from "vue-router";
import { HistoryService } from "@octopus/client-common/google-apps-script/gas-history-service";
import octopusSchedulerRoutes from "../../ui/router";
import { jackpotGameRoutes } from "@octopus/game-jackpot";
import { quizGameRoutes } from "@octopus/game-quiz";
import { hashToPath } from "./initial-hash";
import { createAuthGuard } from "./auth-guard";
import { ensureRole } from "../auth/auth-session";
import { gamePathRedirectRoutes } from "./execute-path";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // ゲームの画面へのパス(/jackpot-admin、/quiz/… など)は、実行画面(/execute)の中へ振り替える
    ...gamePathRedirectRoutes,
    ...octopusSchedulerRoutes.filter((r) => r.path !== "/execute"),
    {
      path: "/execute",
      component: (
        octopusSchedulerRoutes.find((r) => r.path === "/execute") as
          | RouteRecordSingleView
          | undefined
      )?.component,
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
  if (!path) return;
  // path オブジェクトに "?demo=1" を埋め込むとクエリが捨てられるため、resolve でパースして渡す。
  const { path: resolvedPath, query } = router.resolve(path);
  return { path: resolvedPath, query, replace: true };
});

// 入口でログインを要求し、役割(管理者 / 参加者)で行き先を出し分ける(匿名参加の入口とログイン画面だけ公開)。
router.beforeEach(createAuthGuard({ getRole: ensureRole }));

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
