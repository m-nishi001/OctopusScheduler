import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "/root/google_apps_script/octopus-scheduler/src/client/presenters/content-deck/src/router/index.ts";
import { HistoryService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-history-service.ts";
import octopusSchedulerRoutes from "/root/google_apps_script/octopus-scheduler/src/client/octopus-scheduler/src/ui/router/index.ts";
import jackpotGameRoutes from "/root/google_apps_script/octopus-scheduler/src/client/games/jackpot-game/src/core/router/index.ts";
import cardGameRoutes from "/root/google_apps_script/octopus-scheduler/src/client/games/card-game/src/router/index.ts";
import quizGameRoutes from "/root/google_apps_script/octopus-scheduler/src/client/games/quiz-game/src/core/router/index.ts";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    ...routes,
    ...octopusSchedulerRoutes,
    ...jackpotGameRoutes,
    ...cardGameRoutes,
    ...quizGameRoutes,
  ],
});

// ブラウザのURLの変更はHash値の変更であるため、これを定義済ルートとマッピングする
router.beforeEach((to, from, next) => {
  console.log(`[router.beforeEach] to: ${to.fullPath} from: ${from.fullPath}`);
  next();
});

// 画面遷移が発生したらGoogle apps scriptの関数を通じてブラウザのURL（ハッシュ値）を変更する
router.afterEach((route) => {
  const hash = route.fullPath.slice(1);
  HistoryService.replace(null, undefined, hash);
});

// Google apps scriptのHistoryChangeHandlerを設定する
// HistoryService.setChangeHandler((event) => {
//   router.push({ path: `/${event.location.hash}` });
// });

export default router;
