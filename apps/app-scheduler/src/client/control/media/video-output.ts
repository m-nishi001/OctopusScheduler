import { inject, injectable } from "tsyringe";
import type { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { SoundSystemToken } from "./audio";

/** スクリーンに出ている動画の音。`ScreenControl` は、これの音量だけを知る(画面の部品を直接触らない)。 */
export interface VideoOutputPort {
  /** 動画が出ているか。 */
  readonly active: boolean;
  /** 動画の音量を、`ms` ミリ秒かけて 0 まで下げる。動画が出ていなければ、すぐ終わる。 */
  fadeOut(ms: number): Promise<void>;
}

/**
 * スクリーンの動画の窓口。動画の画面(`show-video.vue`)が、mount で `attach`、unmount で `detach` する。
 * 動画の音は、音の中心(`SoundSystem`)の音の通り道に組み込む。フェードは、その音量の予約で行う(動画の画は変えない)。
 */
@injectable()
export class VideoOutput implements VideoOutputPort {
  constructor(@inject(SoundSystemToken) private readonly sound: Pick<SoundSystem, "attachVideo" | "detachVideo" | "fadeOutVideo" | "videoActive">) {}

  get active(): boolean {
    return this.sound.videoActive;
  }

  attach(element: HTMLVideoElement): void {
    this.sound.attachVideo(element);
  }

  detach(): void {
    this.sound.detachVideo();
  }

  fadeOut(ms: number): Promise<void> {
    return this.sound.fadeOutVideo(ms);
  }
}
