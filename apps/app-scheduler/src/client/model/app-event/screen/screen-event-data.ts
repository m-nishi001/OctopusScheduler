import type { ScreenSpec } from "../../media/screen-spec";

/** スクリーン。開始で表示し、終了で消す。 */
export interface ScreenEventData {
  id: string;
  type: "ScreenEvent";
  startTime: Date;
  endTime: Date;
  spec: ScreenSpec;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}
