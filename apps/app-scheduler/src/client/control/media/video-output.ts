import { injectable } from "tsyringe";

/** フェードの 1 コマの間隔(ミリ秒)。 */
const STEP_MS = 50;

/** スクリーンに出ている動画の要素。`ScreenControl` は、これの音量だけを知る(画面の部品を直接触らない)。 */
export interface VideoOutputPort {
  /** 動画が出ているか。 */
  readonly active: boolean;
  /** 動画の音量を、`ms` ミリ秒かけて 0 まで下げる。動画が出ていなければ、すぐ終わる。 */
  fadeOut(ms: number): Promise<void>;
}

/**
 * スクリーンの動画の窓口。動画の画面(`show-video.vue`)が、mount で `attach`、unmount で `detach` する。
 * 要素は同時に 1 つだけ。フェードは、音量を一定の間隔で下げていく(動画の画は変えない)。
 */
@injectable()
export class VideoOutput implements VideoOutputPort {
  private element: HTMLVideoElement | null = null;
  private cancelFade: (() => void) | null = null;

  get active(): boolean {
    return this.element !== null;
  }

  attach(element: HTMLVideoElement): void {
    this.detach();
    this.element = element;
  }

  detach(): void {
    this.cancelFade?.();
    this.element = null;
  }

  fadeOut(ms: number): Promise<void> {
    const element = this.element;
    if (!element || ms <= 0) return Promise.resolve();
    this.cancelFade?.();
    const from = element.volume;
    const startedAt = Date.now();
    return new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startedAt) / ms);
        element.volume = from * (1 - progress);
        if (progress >= 1) finish();
      }, STEP_MS);
      const finish = () => {
        clearInterval(timer);
        this.cancelFade = null;
        resolve();
      };
      this.cancelFade = finish; // 外された(別の動画に替わった・画面を離れた)ときは、そこで終える
    });
  }
}
