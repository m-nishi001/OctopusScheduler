// 音楽再生イベントハンドラ
import type { AudioDetail } from "../domains/schedule/vo/event-details/audio-detail";
import { useLocalStorage, useAudio } from "../../../packages/shared-composables/src";

export async function handleMusicEvent(eventDetail: AudioDetail) {
  console.log("音楽再生イベント:", eventDetail);

  const { get, error: storageError } = useLocalStorage();
  const audio = useAudio();

  try {
    const blob = await get<Blob>(eventDetail.audioID);
    if (!blob) {
      console.error("Blobデータが取得できません:", eventDetail.audioID, storageError.value);
      return;
    }
    await audio.load(blob);
    await audio.play({ fadeIn: eventDetail.fadeInMs });
  } catch (err) {
    console.error("音楽再生処理でエラー:", err);
  }
}
