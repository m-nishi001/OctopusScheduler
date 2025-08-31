// 画像表示イベントハンドラ
import type { ImageDetail } from "../domains/schedule/vo/event-details/image-detail";
export function handleImageEvent(eventDetail: ImageDetail) {
  console.log("画像表示イベント:", eventDetail);
}
