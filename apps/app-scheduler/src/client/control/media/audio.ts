import { inject, injectable } from "tsyringe";
import { AudioService } from "@octopus/client-common/audio/audio-service";
import { AssetSource } from "./asset-source";

/** 音を鳴らす部品(`AudioService`)を DI で差し替えるためのトークン。 */
export const AudioServiceToken = Symbol("AudioService");
export type AudioPlayer = Pick<AudioService, "loadFromBlob" | "play" | "stop" | "disposeInstance">;

/** 音楽。曲(素材 ID)ごとに、再生と停止ができる。 */
@injectable()
export class AudioControl {
  /** 曲ごとの連番。停止が来たら進める。取得を待っている間に停止が来た再生は、届いても鳴らさない。 */
  private readonly seq = new Map<string, number>();
  /** 鳴っている曲(素材 ID → 再生の ID)。 */
  private readonly playing = new Map<string, string>();

  constructor(
    @inject(AssetSource) private readonly source: Pick<AssetSource, "ensure">,
    @inject(AudioServiceToken) private readonly audio: AudioPlayer
  ) {}

  async play(id: string): Promise<void> {
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
    this.playing.set(id, instance);
    await this.audio.play(instance);
  }

  /** 曲を指定するとその曲だけ、省略するとすべて止める。`fadeSec` 秒かけてフェードアウトする。 */
  async stop(id?: string, fadeSec = 0): Promise<void> {
    const ids = id === undefined ? [...new Set([...this.seq.keys(), ...this.playing.keys()])] : [id];
    for (const target of ids) this.seq.set(target, (this.seq.get(target) ?? 0) + 1);
    await Promise.all(ids.map((target) => this.stopInstance(target, fadeSec)));
  }

  private async stopInstance(id: string, fadeSec: number): Promise<void> {
    const instance = this.playing.get(id);
    if (!instance) return;
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
