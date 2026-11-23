import { inject, injectable } from "tsyringe";
import { AudioService } from "@octopus/client-common/audio/audio-service";
import { DEFAULT_FADE_SEC } from "@model/media/media-command";
import type { NowPlayingAudio } from "@model/media/now-playing";
import { AssetSource } from "./asset-source";

/** 音を鳴らす部品(`AudioService`)を DI で差し替えるためのトークン。 */
export const AudioServiceToken = Symbol("AudioService");
/** 音の中心(`SoundSystem`)のトークン。`AudioService`(AudioContext)を `AudioControl` と共有する。 */
export const SoundSystemToken = Symbol("SoundSystem");
export type AudioPlayer = Pick<AudioService, "loadFromBlob" | "play" | "pause" | "stop" | "disposeInstance">;

/** 鳴らした(または一時停止した)曲の、再生の ID と繰り返しの有無。 */
interface Track {
  instance: string;
  loop: boolean;
}

/** 音楽。曲(素材 ID)ごとに、再生と停止ができる。 */
@injectable()
export class AudioControl {
  /** 曲ごとの連番。停止が来たら進める。取得を待っている間に停止が来た再生は、届いても鳴らさない。 */
  private readonly seq = new Map<string, number>();
  /** 鳴っている曲(素材 ID → 再生の ID と、繰り返すか)。フェードアウト中の古い再生は含めない。 */
  private readonly playing = new Map<string, Track>();
  /** 一時停止中の曲(`suspend` で止め、`resume` で続きから鳴らす)。再生位置は再生の部品が持つ。 */
  private readonly suspended = new Map<string, Track>();
  /** 進行中の一時停止。`resume` は、これが終わってから鳴らす。 */
  private suspending: Promise<void> = Promise.resolve();
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

  /** 曲を指定するとその曲だけ、省略するとすべて止める。`fadeSec` 秒かけてフェードアウトする(省略は `DEFAULT_FADE_SEC`。0 は即時停止)。一時停止中の曲は、再開せず破棄する。 */
  async stop(id?: string, fadeSec = DEFAULT_FADE_SEC): Promise<void> {
    const ids =
      id === undefined
        ? [...new Set([...this.seq.keys(), ...this.playing.keys(), ...this.suspended.keys()])]
        : [id];
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

  /** 鳴っているすべての曲を `fadeSec` 秒かけてフェードアウトし、一時停止する。`resume` で止めた位置から続く。 */
  suspend(fadeSec = 1): Promise<void> {
    const targets = [...this.playing.entries()];
    for (const [id, track] of targets) {
      this.playing.delete(id);
      this.suspended.set(id, track);
    }
    if (targets.length > 0) this.notify();
    const ms = Math.round(Math.max(0, fadeSec) * 1000);
    const work = Promise.all(
      targets.map(async ([, track]) => {
        try {
          await this.audio.pause(track.instance, ms);
        } catch (error) {
          console.error("音楽を一時停止できませんでした", error);
        }
      })
    ).then(() => undefined);
    this.suspending = this.suspending.then(() => work);
    return work;
  }

  /** 一時停止中の曲を、止めた位置から続けて鳴らす。その間に同じ曲が鳴っていたら、再開せずに破棄する。 */
  async resume(fadeInSec = 1): Promise<void> {
    await this.suspending;
    const tracks = [...this.suspended.entries()];
    this.suspended.clear();
    await Promise.all(
      tracks.map(async ([id, track]) => {
        if (this.playing.has(id)) {
          this.audio.disposeInstance(track.instance);
          return;
        }
        this.playing.set(id, track);
        this.notify();
        try {
          await this.audio.play(
            track.instance,
            Math.round(Math.max(0, fadeInSec) * 1000),
            track.loop,
            () => this.onEnded(id, track.instance)
          );
        } catch (error) {
          if (this.playing.get(id)?.instance === track.instance) {
            this.playing.delete(id);
            this.notify();
          }
          this.audio.disposeInstance(track.instance);
          console.error("音楽を再開できませんでした", error);
        }
      })
    );
  }

  private async stopInstance(id: string, fadeSec: number): Promise<void> {
    const parked = this.suspended.get(id);
    if (parked) {
      this.suspended.delete(id);
      this.audio.disposeInstance(parked.instance);
    }
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
