import type { HostAgent } from "@octopus/session-hub";
import { PLAYBACK_NS, buildPlaybackSlice, type NowPlayingAudio } from "@model/media/now-playing";

/** 鳴っている曲の窓口(`AudioControl` の一部)。 */
export interface PlaybackSource {
  snapshot(): NowPlayingAudio[];
  subscribe(listener: () => void): () => void;
}

/**
 * ホストが実際に鳴らしている曲を、ルーム状態の `playback` に公開する(管理端末が「いま流れているもの」を表示できるように)。
 * 素材の一覧の `media` とは分ける(`media` は番号が変わるたびに、管理端末がサーバーの一覧を読み直すため)。
 * 公開するのは、次のときだけ。
 *   - ホストとして入室したとき(前のホストが公開していた分を、必ず上書きする)
 *   - 鳴っている曲が変わったとき(再生・停止・自然に終わった)
 * 持つ状態は無い。公開のたびに、そのときの曲の一覧を作る。
 */
export function registerPlaybackPublisher(
  agent: Pick<HostAgent, "active" | "connection" | "publishSlice">,
  /** 曲の窓口。ホストとして入室するまで取り出さない(ホストでない端末で、音の部品を作らないため)。 */
  getSource: () => PlaybackSource
): () => void {
  let source: PlaybackSource | null = null;
  let unsubscribeAudio: (() => void) | null = null;

  const publish = () => {
    if (!agent.active || !source) return;
    void agent.publishSlice(PLAYBACK_NS, buildPlaybackSlice(source.snapshot()));
  };

  let wasHost = false;
  const unsubscribeConnection = agent.connection.subscribe((state) => {
    const isHost = state.phase === "connected" && state.role === "host";
    if (isHost && !wasHost) {
      if (!source) {
        source = getSource();
        unsubscribeAudio = source.subscribe(publish);
      }
      publish();
    }
    wasHost = isHost;
  });

  return () => {
    unsubscribeConnection();
    unsubscribeAudio?.();
  };
}
