import { domainEventBus } from "src/domains/event-bus";
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
}