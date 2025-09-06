import { domainEventBus } from "../../../event-bus";
import type { IEventDetail } from "./event-detail";

export class VideoDetail implements IEventDetail {
  constructor(
    public readonly videoID: string,
    public readonly fadeInMs: number,
    public readonly fadeOutMs: number,
  ) {
    if (fadeInMs < 0 || fadeOutMs < 0) {
      throw new Error('フェードイン、フェードアウト時間は0以上である必要があります。');
    }
  }

  public execute(): void {
    domainEventBus.emit('video-playback', this);
  }

  public static from(obj: unknown): VideoDetail {
    if (obj instanceof VideoDetail) return obj;
    const plain = obj as Record<string, unknown> | undefined;
    const videoID = (plain?.videoID ?? plain?.videoId ?? plain?.id ?? "") as string;
    const fadeInMs = typeof plain?.fadeInMs === 'number' ? (plain!.fadeInMs as number) : Number(plain?.fadeInMs ?? 0);
    const fadeOutMs = typeof plain?.fadeOutMs === 'number' ? (plain!.fadeOutMs as number) : Number(plain?.fadeOutMs ?? 0);
    return new VideoDetail(videoID, fadeInMs, fadeOutMs);
  }
}