interface BlobSource {
  blobOf(name: string): Promise<Blob | null>;
}

/** BGM の素材の名前から Blob を読み込む関数を作る。見つからない・読めないときは null(演出は止めない)。 */
export function createBgmBlobLoader(source: BlobSource) {
  return async (name: string | null): Promise<Blob | null> => {
    if (!name) return null;
    try {
      return await source.blobOf(name);
    } catch (e) {
      console.warn("[BgmBlobLoader] failed to load media", name, e);
      return null;
    }
  };
}
