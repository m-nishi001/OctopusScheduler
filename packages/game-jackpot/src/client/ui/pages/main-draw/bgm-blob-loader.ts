interface AssetPort {
  getAssetDataById(id: string): Promise<{ blob?: unknown } | null | undefined>;
}

/** 保存された値(Blob / URL文字列 / Blobに似たオブジェクト)から、再生できる Blob を取り出す。 */
async function toBlob(stored: unknown): Promise<Blob | null> {
  if (!stored) return null;
  if (stored instanceof Blob) return stored;
  if (typeof stored === "string") {
    const resp = await fetch(stored);
    return resp.ok ? resp.blob() : null;
  }
  const like = stored as { type?: string; size?: number };
  if (typeof stored === "object" && like.type !== undefined && like.size !== undefined) {
    return new Blob([stored as BlobPart], { type: like.type || "application/octet-stream" });
  }
  return null;
}

/** BGMのアセットIDから Blob を読み込む関数を作る。見つからない・読めないときは null(演出は止めない)。 */
export function createBgmBlobLoader(assets: AssetPort) {
  return async (assetId: string | null): Promise<Blob | null> => {
    if (!assetId) return null;
    try {
      const asset = await assets.getAssetDataById(assetId);
      return await toBlob(asset?.blob);
    } catch (e) {
      console.warn("[BgmBlobLoader] failed to load asset", assetId, e);
      return null;
    }
  };
}
