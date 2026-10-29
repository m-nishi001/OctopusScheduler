/**
 * 顔写真をアップロード用に整える: 長辺 {@link MAX_PHOTO_EDGE}px に縮小し、WebP(使えなければ JPEG)にして、
 * 内容のハッシュ(SHA-256 の先頭16桁)を付ける。Vue には依存しない。
 * 画像のデコード・エンコードだけがブラウザ依存なので差し替えられるようにしてあり、残りは純粋な関数。
 */

/** 縮小後の長辺(px)。 */
export const MAX_PHOTO_EDGE = 512;

export interface PreparedPhoto {
  /** 縮小後の画像の SHA-256 の先頭16桁(16進)。名簿の `photo` に入れる ID になる。 */
  hash: string;
  mime: string;
  /** `data:<mime>;base64,…`。そのまま画面に出せ、サーバーへも送れる。 */
  dataUrl: string;
}

/** 長辺が `max` を超えるときだけ、縦横比を保って縮める(拡大はしない)。 */
export function fitWithin(width: number, height: number, max: number = MAX_PHOTO_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** バイト列の SHA-256 の先頭16桁(16進の小文字)。 */
export async function hashPhotoBytes(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** バイト列をデータURLにする。 */
export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:${mime};base64,${btoa(binary)}`;
}

/** 縮小・変換を済ませた画像のバイト列。 */
export interface EncodedImage {
  bytes: Uint8Array;
  mime: string;
}

/** 画像ファイルを縮小して WebP(不可なら JPEG)にする。ブラウザ専用(createImageBitmap + canvas)。 */
export async function resizeImageInBrowser(file: Blob, max: number = MAX_PHOTO_EDGE): Promise<EncodedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を処理できません");
    ctx.drawImage(bitmap, 0, 0, width, height);
    for (const [mime, quality] of [["image/webp", 0.85], ["image/jpeg", 0.88]] as const) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
      // 非対応のブラウザは、指定と違う形式(PNG)で返す。その場合は次の形式を試す。
      if (blob && blob.type === mime) return { bytes: new Uint8Array(await blob.arrayBuffer()), mime };
    }
    throw new Error("画像を変換できません");
  } finally {
    bitmap.close();
  }
}

/** 画像ファイルをアップロード用に整える。`encode` は縮小・変換の実装(テストで差し替える)。 */
export async function preparePhoto(
  file: Blob,
  encode: (file: Blob) => Promise<EncodedImage> = resizeImageInBrowser
): Promise<PreparedPhoto> {
  const { bytes, mime } = await encode(file);
  return { hash: await hashPhotoBytes(bytes), mime, dataUrl: bytesToDataUrl(bytes, mime) };
}
