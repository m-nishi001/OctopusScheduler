import type { Router } from "vue-router";
import { TransitionPageEventHandler } from "./transition-page-event-handler";

/** 実行画面で、予定イベントの画面遷移を受けるハンドラ(音楽・スクリーンは単体機能を直接呼ぶ)を登録する。 */
export function registerEventHandlers(router: Router) {
  TransitionPageEventHandler.register(router);
}
