// 音楽再生イベントハンドラ
import type { AudioDetail } from "../domains/schedule/vo/event-details/audio-detail";
export function handleMusicEvent(eventDetail: AudioDetail) {
  console.log("音楽再生イベント:", eventDetail);
}
