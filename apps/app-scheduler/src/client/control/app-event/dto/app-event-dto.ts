import type { ScreenSpec } from "../../../model/media/screen-spec";

// 設定画面のフォームが作る、予定イベントの入力の形(時刻と記録用の日時を除いたもの)。
export interface AudioEventDto {
  actionType: "AudioEvent";
  id?: string;
  audioId: string;
  fadeOutSec: number;
}

export interface ScreenEventDto {
  actionType: "ScreenEvent";
  id?: string;
  spec: ScreenSpec;
}

export interface TransitionPageEventDto {
  actionType: "TransitionPageEvent";
  id?: string;
  transitionUrl: string;
  fadeOutDuration?: number;
}

export type AppEventDto = AudioEventDto | ScreenEventDto | TransitionPageEventDto;
