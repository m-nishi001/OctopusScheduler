import { inject, injectable } from "tsyringe";
import { AudioService } from "@octopus/client-common/audio/audio-service";
import { DEFAULT_FADE_SEC } from "@model/media/media-command";
import type { NowPlayingAudio } from "@model/media/now-playing";
import { AssetSource } from "./asset-source";

/** 音を鳴らす部品(`AudioService`)を DI で差し替えるためのトークン。 */
export const AudioServiceToken = Symbol("AudioService");
export type AudioPlayer = Pick<AudioService, "loadFromBlob" | "play" | "stop" | "disposeInstance">;

/** 音楽。曲(素材 ID)ごとに、再生と停止ができる。 */
@injectable()
export class AudioControl {
  /** 曲ごとの連番。停止が来たら進める。取得を待っている間に停止が来た再生は、届いても鳴らさない。 */
  private readonly seq = new Map<string, number>();
  /** 鳴っている曲(素材 ID → 再生の ID とループか)。フェードアウト中の古い再生は含めない。 */
  private readonly playing = new Map<string, { instance: string; loop: boolean }>();
  private readonly listeners = new Set<() => void>();

  constructor(
    @inject(AssetSource) private readonly source: Pick<AssetSource, "ensure">,
    @inject(AudioServiceToken) private readonly audio: AudioPlayer
  ) {}

  /** 鳴っている曲の一覧(鳴らし始めた順)。曲が自然に終わったら、一覧から消える。 */
  snapshot(): NowPlayingAudio[] {
    return [...this.playing].map(([assetId, { loop }]) => ({ assetId, loop }));
  }

  /** 鳴っている曲の一覧が変わったら知らせる。戻り値は解除関数。 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }

  /**
   * 曲を鳴らす。`loop` なら、止めるまで繰り返す。
   * 同じ曲がすでに鳴っているときは、古い方を `fadeSec` 秒でフェードアウトしながら、新しい方を鳴らす(クロスフェード)。古い方の完了は待たない。
   */
  async play(id: string, loop = false, fadeSec = DEFAULT_FADE_SEC): Promise<void> {
    const mine = (this.seq.get(id) ?? 0) + 1;
    this.seq.set(id, mine);
    const blob = await this.source.ensure(id);
    if (this.seq.get(id) !== mine) return;
    const instance = await this.audio.loadFromBlob(blob);
    if (this.seq.get(id) !== mine) {
      this.audio.disposeInstance(instance);
      return;
    }
    const previous = this.playing.get(id);
    if (previous) void this.release(previous.instance, fadeSec);
    this.playing.set(id, { instance, loop });
    this.notify();
    try {
      await this.audio.play(instance, 0, loop, () => this.onEnded(id, instance));
    } catch (error) {
      // 鳴らせなかった曲は、「鳴っている曲」に残さない
      if (this.playing.get(id)?.instance === instance) {
        this.playing.delete(id);
        this.notify();
      }
      this.audio.disposeInstance(instance);
      throw error;
    }
  }

  /** 曲を指定するとその曲だけ、省略するとすべて止める。`fadeSec` 秒かけてフェードアウトする(省略は `DEFAULT_FADE_SEC`。0 は即時停止)。 */
  async stop(id?: string, fadeSec = DEFAULT_FADE_SEC): Promise<void> {
    const ids = id === undefined ? [...new Set([...this.seq.keys(), ...this.playing.keys()])] : [id];
    for (const target of ids) this.seq.set(target, (this.seq.get(target) ?? 0) + 1);
    await Promise.all(ids.map((target) => this.stopInstance(target, fadeSec)));
  }

  /** 曲が自然に終わった。まだその再生が「鳴っている曲」なら一覧から外して片づける(止めたあとや、再生し直したあとの古い通知は無視する)。 */
  private onEnded(id: string, instance: string): void {
    if (this.playing.get(id)?.instance !== instance) return;
    this.playing.delete(id);
    this.notify();
    this.audio.disposeInstance(instance);
  }

  private async stopInstance(id: string, fadeSec: number): Promise<void> {
    const current = this.playing.get(id);
    if (!current) return;
    this.playing.delete(id);
    this.notify();
    await this.release(current.instance, fadeSec);
  }

  /** 再生の ID を、`fadeSec` 秒でフェードアウトして止め、片づける。失敗しても片づけて、例外にしない。 */
  private async release(instance: string, fadeSec: number): Promise<void> {
    try {
      await this.audio.stop(instance, Math.round(Math.max(0, fadeSec) * 1000));
    } catch (error) {
      console.error("音楽を止められませんでした", error);
    } finally {
      this.audio.disposeInstance(instance);
    }
  }
}
