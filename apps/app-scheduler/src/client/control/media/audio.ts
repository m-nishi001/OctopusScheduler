import { inject, injectable } from "tsyringe";
import type { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { DEFAULT_FADE_SEC } from "@model/media/media-command";
import type { NowPlayingAudio } from "@model/media/now-playing";
import { AssetSource } from "./asset-source";

/** 音の中心(`SoundSystem`)のトークン。ページに1つ。 */
export const SoundSystemToken = Symbol("SoundSystem");

const toMs = (sec: number) => Math.round(Math.max(0, sec) * 1000);

/**
 * 場内BGM(管理端末の「音楽」の指示で鳴らす曲)。音の中心(`SoundSystem`)の `venue` チャンネルの薄い包みで、持つ状態は無い。
 *   - 同じ曲をもう一度鳴らすと、古い方をフェードアウトしながら新しい方を鳴らす(クロスフェード)
 *   - ゲームに入る・出るときの一時停止と再開は、`SoundSystem.enterGame` / `leaveGame` が行う
 * 画面のBGM(ジャックポット・クイズ)は入れない(`screen` チャンネル)。
 */
@injectable()
export class AudioControl {
  constructor(
    @inject(AssetSource) private readonly source: Pick<AssetSource, "ensure">,
    @inject(SoundSystemToken) private readonly sound: Pick<SoundSystem, "venue">
  ) {}

  /** 鳴っている曲の一覧(鳴らし始めた順)。一時停止中の曲・読み込み中の曲・自然に終わった曲は含めない。 */
  snapshot(): NowPlayingAudio[] {
    return this.sound.venue.state.tracks.filter((t) => t.status === "playing").map((t) => ({ assetId: t.key, loop: t.loop }));
  }

  /** 鳴っている曲の一覧が変わったら知らせる。戻り値は解除関数。 */
  subscribe(listener: () => void): () => void {
    return this.sound.venue.subscribe(listener);
  }

  /**
   * 曲を鳴らす。`loop` なら、止めるまで繰り返す。同じ曲がすでに鳴っているときは、古い方を `fadeSec` 秒でフェードアウトしながら新しい方を鳴らす。
   * 素材を取れなかった・鳴らせなかったときは例外にする(管理端末に知らせるため)。取得を待つ間に止められた再生は、鳴らさず、例外にもしない。
   */
  async play(id: string, loop = false, fadeSec = DEFAULT_FADE_SEC): Promise<void> {
    let loadError: unknown;
    const load = async () => {
      try {
        return await this.source.ensure(id);
      } catch (error) {
        loadError = error;
        throw error;
      }
    };
    const result = await this.sound.venue.play({ key: id, load }, { loop, replaceFadeMs: toMs(fadeSec) });
    if (result === "failed") throw loadError ?? new Error(`音楽を鳴らせませんでした: ${id}`);
  }

  /** 曲を指定するとその曲だけ、省略するとすべて止める。`fadeSec` 秒かけてフェードアウトする(省略は `DEFAULT_FADE_SEC`。0 は即時停止)。一時停止中の曲は、再開せず破棄する。 */
  stop(id?: string, fadeSec = DEFAULT_FADE_SEC): Promise<void> {
    return this.sound.venue.stop({ key: id, fadeMs: toMs(fadeSec) });
  }
}
