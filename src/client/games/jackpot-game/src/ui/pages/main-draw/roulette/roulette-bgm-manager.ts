import { useRouletteAudio } from "./roulette-audio";

const cache = new Map<string, Blob | null>();

export const RouletteBgmManager = {
  async load(
    assetId: string | null,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>
  ) {
    if (!assetId) return null;
    if (cache.has(assetId)) return cache.get(assetId) || null;
    try {
      const blob = await loadBgmBlob(assetId);
      cache.set(assetId, blob || null);
      return blob || null;
    } catch (e) {
      console.warn("[RouletteBgmManager] failed to load asset", assetId, e);
      cache.set(assetId, null);
      return null;
    }
  },

  async playAsset(
    assetId: string | null,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>
  ) {
    if (!assetId) return null;
    const blob = await this.load(assetId, loadBgmBlob);
    if (!blob) return null;
    return this.playBlob(blob);
  },

  async playBlob(blob: Blob | null) {
    if (!blob) return null;
    try {
      const audioApi = useRouletteAudio();
      // 詳細ログ: audio APIの状態
      console.log("[RouletteBgmManager] playBlob: before tryResumeBgm", {
        isBgmPlaying: audioApi.isBgmPlaying?.value,
        currentBgmSrc: audioApi.currentBgmSrc?.value,
        bgmAutoplayBlocked: audioApi.bgmAutoplayBlocked?.value,
        audioApi,
      });
      if (typeof audioApi.tryResumeBgm === "function") {
        try {
          await audioApi.tryResumeBgm();
          console.log("[RouletteBgmManager] tryResumeBgm called successfully");
        } catch (e) {
          console.warn("[RouletteBgmManager] tryResumeBgm failed", e);
        }
      }
      // 詳細ログ: startBgm前のaudio element状態
      try {
        const state = audioApi.getHtmlAudioState?.();
        console.log(
          "[RouletteBgmManager] audio element state before startBgm",
          state
        );
      } catch (e) {
        console.warn(
          "[RouletteBgmManager] failed to get audio element state before startBgm",
          e
        );
      }
      if (typeof audioApi.startBgm === "function") {
        await audioApi.startBgm(blob);
        console.log("[RouletteBgmManager] startBgm called");
      }
      // 詳細ログ: startBgm後のaudio element状態
      try {
        const state = audioApi.getHtmlAudioState?.();
        console.log(
          "[RouletteBgmManager] audio element state after startBgm",
          state
        );
      } catch (e) {
        console.warn(
          "[RouletteBgmManager] failed to get audio element state after startBgm",
          e
        );
      }
      // 追加: audio elementのpaused, currentTime, volume, src なども出力
      try {
        const audioEl = document.querySelector("audio");
        if (audioEl) {
          console.log(
            "[RouletteBgmManager] <audio> element: paused=",
            audioEl.paused,
            "currentTime=",
            audioEl.currentTime,
            "volume=",
            audioEl.volume,
            "src=",
            audioEl.src
          );
        } else {
          console.log("[RouletteBgmManager] <audio> element not found in DOM");
        }
      } catch (e) {
        console.warn(
          "[RouletteBgmManager] failed to log <audio> element state",
          e
        );
      }
      return blob;
    } catch (e) {
      console.warn("[RouletteBgmManager] failed to play blob", e);
      return null;
    }
  },

  async stop() {
    try {
      const { stopBgmAudio } = useRouletteAudio();
      if (typeof stopBgmAudio === "function") {
        await stopBgmAudio();
      }
    } catch (e) {
      console.warn("[RouletteBgmManager] failed to stop bgm", e);
    }
  },

  clear(assetId: string | null) {
    if (!assetId) return;
    cache.delete(assetId);
  },

  clearAll() {
    cache.clear();
  },
};
