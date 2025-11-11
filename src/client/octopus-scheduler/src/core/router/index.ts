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
HistoryService.setChangeHandler((event) => {
  router.push({ path: `/${event.location.hash}` });
});

export default router;
