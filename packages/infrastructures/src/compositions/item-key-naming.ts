/**
 * addDriveData 系ユースケースが使う、キー命名規約。
 *
 * `IKeyValueStorage` はフォルダ階層を知らないため、Drive の「フォルダ」に相当する
 * ものは `"<namespace>/<localName>"` というキー内の規約として表現する。さらに
 * `localName` 自体に `${itemId}_${displayName}` というアプリ側ID埋め込みの回避策
 * (Driveにアプリ側IDを保存する専用フィールドが無いことへの対応)を重ねる。
 * どちらもストレージ実装(GAS/Cloudflare)には持たせず、ここに集約する。
 */
import type { StoredItemMeta } from "../interfaces/key-value-storage";
import type { DriveMetadata } from "./types";

export function makeKey(namespace: string, localName: string): string {
  return `${namespace}/${localName}`;
}

export function splitKey(key: string): { namespace: string; localName: string } {
  const idx = key.indexOf("/");
  if (idx === -1) {
    throw new Error(`Invalid storage key (missing "<namespace>/" prefix): ${key}`);
  }
  return { namespace: key.slice(0, idx), localName: key.slice(idx + 1) };
}

export function encodeLocalName(itemId: string, displayName: string): string {
  const normalized =
    typeof displayName.normalize === "function"
      ? displayName.normalize("NFC")
      : displayName;
  return `${itemId}_${normalized}`;
}

export function decodeItemId(localName: string): string {
  return localName.split("_")[0];
}

export function decodeDisplayName(localName: string): string {
  return localName.split("_").slice(1).join("_");
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
  meta: StoredItemMeta,
  itemId?: string
): DriveMetadata {
  const { namespace, localName } = splitKey(meta.key);
  return {
    driveDataId: itemId ?? decodeItemId(localName),
    fileId: meta.key,
    parentFolderId: namespace,
    lastUpdate: meta.updatedAt,
    size: meta.size,
  };
}
