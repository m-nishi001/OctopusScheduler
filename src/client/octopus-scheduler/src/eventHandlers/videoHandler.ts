// 動画再生イベントハンドラ
import type { VideoDetail } from "../domains/schedule/vo/event-details/video-detail";
export function handleVideoEvent(eventDetail: VideoDetail) {
  console.log("動画再生イベント:", eventDetail);
}
