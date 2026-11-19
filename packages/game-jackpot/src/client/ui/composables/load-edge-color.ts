import { edgeColor } from "@model/edge-color";

/** 縁の色を求めるときの、読み込む画像の長辺の最大(これより大きい画像は縮めて数える)。 */
const MAX_SIDE = 256;

/**
 * 画像(URL)の縁の色を `#rrggbb` で返す。読み込み・描画・読み取りのどこで失敗しても(別のオリジンの画像でキャンバスが汚れた場合など)
 * 例外にせず null を返す。呼び出し側は null のとき、既存の暗い背景色のままにする。
 */
export function loadEdgeColor(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight, 1));
          const width = Math.max(1, Math.round(img.naturalWidth * scale));
          const height = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(edgeColor(ctx.getImageData(0, 0, width, height)));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}
