import { useRouletteAudio } from "./roulette-audio";

const cache = new Map<string, Blob | null>();

export const RouletteBgmManager = {
  async load(
    name: string | null,
    loadBgmBlob: (name: string | null) => Promise<Blob | null>
  ) {
    if (!name) return null;
    if (cache.has(name)) return cache.get(name) || null;
    try {
      const blob = await loadBgmBlob(name);
      cache.set(name, blob || null);
      return blob || null;
    } catch (e) {
      console.warn("[RouletteBgmManager] failed to load media", name, e);
      cache.set(name, null);
      return null;
    }
  },

  async playMedia(
    name: string | null,
    loadBgmBlob: (name: string | null) => Promise<Blob | null>
  ) {
    if (!name) return null;
    const blob = await this.load(name, loadBgmBlob);
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

  clear(name: string | null) {
    if (!name) return;
    cache.delete(name);
  },

  clearAll() {
    cache.clear();
  },
};
