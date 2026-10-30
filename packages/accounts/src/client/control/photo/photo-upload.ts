/**
 * 整えた写真をサーバーへ送る。サーバーに既にある写真は飛ばし(確認は1回の問い合わせ)、
 * 残りを Promise プールで並列に送る。写真の ID は内容のハッシュなので、同じ写真を送り直しても同じキーへの上書き。
 * 何度やり直しても安全で、途中で止まっても、もう一度流せば続きから進む。
 */
import { mapPool } from "../pool/promise-pool";
import type { PoolOptions } from "../pool/promise-pool";
import type { PreparedPhoto } from "./photo-prepare";

/** アップロードに必要な窓口(AccountsRepository がそのまま満たす)。 */
export interface MemberPhotoUploader {
  existsMemberPhotos(hashes: string[]): Promise<string[]>;
  putMemberPhoto(hash: string, dataUrl: string): Promise<void>;
}

/** 写真をサーバーに揃える。送った枚数と、すでにあって飛ばした枚数を返す。1枚でも失敗したら例外。 */
export async function uploadMemberPhotos(
  uploader: MemberPhotoUploader,
  photos: readonly PreparedPhoto[],
  options?: PoolOptions
): Promise<{ uploaded: number; skipped: number }> {
  const unique = [...new Map(photos.map((p) => [p.hash, p] as const)).values()];
  if (unique.length === 0) return { uploaded: 0, skipped: 0 };
  const existing = new Set(await uploader.existsMemberPhotos(unique.map((p) => p.hash)));
  const missing = unique.filter((p) => !existing.has(p.hash));
  await mapPool(missing, (photo) => uploader.putMemberPhoto(photo.hash, photo.dataUrl), options);
  return { uploaded: missing.length, skipped: unique.length - missing.length };
}
