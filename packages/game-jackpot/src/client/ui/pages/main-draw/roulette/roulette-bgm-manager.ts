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

  /** BGM を再生する。自動再生がブロックされていれば先に再開を試す。失敗しても演出は止めず null を返す。 */
  async playBlob(blob: Blob | null) {
    if (!blob) return null;
    try {
      const audioApi = useRouletteAudio();
      try {
        await audioApi.tryResumeBgm();
      } catch (e) {
        console.warn("[RouletteBgmManager] tryResumeBgm failed", e);
      }
      await audioApi.startBgm(blob);
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
