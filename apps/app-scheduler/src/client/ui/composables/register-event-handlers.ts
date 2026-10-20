import type { Router } from "vue-router";
import { PlayAudioEventHandler } from "./play-audio-event-handler";
import { ShowContentEventHandler } from "../pages/execute/show-content/show-content-event-handler";
import { SlideshowEventHandler } from "./slideshow-event-handler";
import { TransitionPageEventHandler } from "./transition-page-event-handler";

/** 実行画面で、予定イベントの各種の実行(音声・コンテンツ表示・スライドショー・画面遷移)を受けるハンドラを登録する。 */
export function registerEventHandlers(router: Router) {
  PlayAudioEventHandler.register();
  ShowContentEventHandler.register(router);
  SlideshowEventHandler.register(router);
  TransitionPageEventHandler.register(router);
}
