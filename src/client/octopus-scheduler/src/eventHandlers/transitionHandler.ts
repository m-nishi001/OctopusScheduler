// 画面遷移イベントハンドラ
import type { TransitionDetail } from "../domains/schedule/vo/event-details/transition-detail";
export function handleTransitionEvent(eventDetail: TransitionDetail) {
  console.log("画面遷移イベント:", eventDetail);
}
