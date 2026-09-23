/**
 * addDriveData 系ユースケースが使う、ファイル名へのID埋め込み規約。
 *
 * `${itemId}_${displayName}` という命名は Drive にアプリ側IDを保存する専用の
 * フィールドが無いことへの回避策であり、ストレージ実装(GAS/Cloudflare)には
 * 持たせず、ここに集約する。
 */
import type { DriveMetadata, StoredFileMeta } from "../file-storage-repository";

export function encodeFileName(itemId: string, displayName: string): string {
  const normalized =
    typeof displayName.normalize === "function"
      ? displayName.normalize("NFC")
      : displayName;
  return `${itemId}_${normalized}`;
}

export function decodeItemId(storedFileName: string): string {
  return storedFileName.split("_")[0];
}

export function decodeDisplayName(storedFileName: string): string {
  return storedFileName.split("_").slice(1).join("_");
}

export function extractBase64FromDataUrl(dataUrlOrBase64: string): string {
  const data = dataUrlOrBase64 || "";
  const m = data.match(/^data:(.*?);base64,(.*)$/);
  if (m) return m[2];
  return data;
}

export function toDataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export function toDriveMetadata(
  meta: StoredFileMeta,
  itemId: string = decodeItemId(meta.fileName)
): DriveMetadata {
  return {
    driveDataId: itemId,
    fileId: meta.fileId,
    parentFolderId: meta.parentFolderId,
    lastUpdate: meta.lastUpdate,
    size: meta.size,
  };
}
