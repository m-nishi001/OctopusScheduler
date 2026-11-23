import { inject, injectable } from "tsyringe";
import { AudioService } from "@octopus/client-common/audio/audio-service";
import { AssetSource } from "./asset-source";

/** 音を鳴らす部品(`AudioService`)を DI で差し替えるためのトークン。 */
export const AudioServiceToken = Symbol("AudioService");
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
  /** 鳴っている曲(素材 ID → 再生の ID と、繰り返すか)。 */
  private readonly playing = new Map<string, Track>();
  /** 一時停止中の曲(`suspend` で止め、`resume` で続きから鳴らす)。再生位置は再生の部品が持つ。 */
  private readonly suspended = new Map<string, Track>();
  /** 進行中の一時停止。`resume` は、これが終わってから鳴らす。 */
  private suspending: Promise<void> = Promise.resolve();

  constructor(
    @inject(AssetSource) private readonly source: Pick<AssetSource, "ensure">,
    @inject(AudioServiceToken) private readonly audio: AudioPlayer
  ) {}

  /** 曲を鳴らす。`loop` なら、止めるまで繰り返す。 */
  async play(id: string, loop = false): Promise<void> {
    const mine = (this.seq.get(id) ?? 0) + 1;
    this.seq.set(id, mine);
    const blob = await this.source.ensure(id);
    if (this.seq.get(id) !== mine) return;
    const instance = await this.audio.loadFromBlob(blob);
    if (this.seq.get(id) !== mine) {
      this.audio.disposeInstance(instance);
      return;
    }
    await this.stopInstance(id, 0);
    this.playing.set(id, { instance, loop });
    await this.audio.play(instance, 0, loop);
  }

  /** 曲を指定するとその曲だけ、省略するとすべて止める。`fadeSec` 秒かけてフェードアウトする。一時停止中の曲は、再開せず破棄する。 */
  async stop(id?: string, fadeSec = 0): Promise<void> {
    const ids =
      id === undefined
        ? [...new Set([...this.seq.keys(), ...this.playing.keys(), ...this.suspended.keys()])]
        : [id];
    for (const target of ids) this.seq.set(target, (this.seq.get(target) ?? 0) + 1);
    await Promise.all(ids.map((target) => this.stopInstance(target, fadeSec)));
  }

  /** 鳴っているすべての曲を `fadeSec` 秒かけてフェードアウトし、一時停止する。`resume` で止めた位置から続く。 */
  suspend(fadeSec = 1): Promise<void> {
    const targets = [...this.playing.entries()];
    for (const [id, track] of targets) {
      this.playing.delete(id);
      this.suspended.set(id, track);
    }
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
        try {
          await this.audio.play(track.instance, Math.round(Math.max(0, fadeInSec) * 1000), track.loop);
        } catch (error) {
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
    const track = this.playing.get(id);
    if (!track) return;
    const instance = track.instance;
    this.playing.delete(id);
    try {
      await this.audio.stop(instance, Math.round(Math.max(0, fadeSec) * 1000));
    } catch (error) {
      console.error("音楽を止められませんでした", error);
    } finally {
      this.audio.disposeInstance(instance);
    }
  }
}
