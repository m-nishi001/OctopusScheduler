import { domainEventBus } from "../../../event-bus";
import type { IEventDetail } from "./event-detail";

export class AudioDetail implements IEventDetail {
  constructor(
    public readonly audioID: string,
    public readonly fadeInMs: number,
    public readonly fadeOutMs: number,
  ) {
    if (fadeInMs < 0 || fadeOutMs < 0) {
      throw new Error('フェードイン、フェードアウト時間は0以上である必要があります。');
    }
  }

  public execute(): void {
    domainEventBus.emit('audio-playback', this);
  }
  public static from(obj: unknown): AudioDetail {
    if (obj instanceof AudioDetail) return obj;
    const plain = obj as Record<string, unknown> | undefined;
    const audioID = (plain?.audioID ?? plain?.audioId ?? plain?.id ?? "") as string;
    const fadeInMs = typeof plain?.fadeInMs === 'number' ? (plain!.fadeInMs as number) : Number(plain?.fadeInMs ?? 0);
    const fadeOutMs = typeof plain?.fadeOutMs === 'number' ? (plain!.fadeOutMs as number) : Number(plain?.fadeOutMs ?? 0);
    return new AudioDetail(audioID, fadeInMs, fadeOutMs);
  }
}