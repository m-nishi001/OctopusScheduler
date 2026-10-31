/** 音楽。開始で再生し、終了で `fadeOutSec` 秒かけてフェードアウトして止める。 */
export interface AudioEventData {
  id: string;
  type: "AudioEvent";
  startTime: Date;
  endTime: Date;
  audioId: string;
  fadeOutSec: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}
