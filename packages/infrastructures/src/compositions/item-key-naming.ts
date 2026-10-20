/**
 * addDriveData 系ユースケースが使う、キー命名規約。
 *
 * `IKeyValueStorage` はフォルダ階層を知らないため、Drive の「フォルダ」に相当する
 * ものは `"<namespace>/<localName>"` というキー内の規約として表現する
 * (namespace は `storage-paths.ts` の `<module>/<kind>`。最後の `/` で分割する)。さらに
 * `localName` 自体に `${itemId}_${displayName}` というアプリ側ID埋め込みの回避策
 * (Driveにアプリ側IDを保存する専用フィールドが無いことへの対応)を重ねる。
 * どちらもストレージ実装(GAS/Cloudflare)には持たせず、ここに集約する。
 */
import type { StoredItemMeta } from "../interfaces/key-value-storage";
import type { DriveMetadata } from "./types";

/** 名前空間とローカル名から、保存先のキー(`namespace/localName`)を作る。 */
export function makeKey(namespace: string, localName: string): string {
  return `${namespace}/${localName}`;
}

/** 保存先のキーを、名前空間とローカル名に分ける。`/` が無いキーは例外。 */
export function splitKey(key: string): { namespace: string; localName: string } {
  const idx = key.lastIndexOf("/");
  if (idx === -1) {
    throw new Error(`Invalid storage key (missing "<namespace>/" prefix): ${key}`);
  }
  return { namespace: key.slice(0, idx), localName: key.slice(idx + 1) };
}

/** 素材の id と表示名から、ローカル名(`<id>_<表示名>`)を作る。表示名は NFC に正規化し、パス区切りの `/` は置き換える。 */
export function encodeLocalName(itemId: string, displayName: string): string {
  const normalized =
    typeof displayName.normalize === "function"
      ? displayName.normalize("NFC")
      : displayName;
  // `/` はパス区切りと衝突するため置換する。
  return `${itemId}_${normalized.replace(/\//g, "_")}`;
}

/** ローカル名から素材の id を取り出す。 */
export function decodeItemId(localName: string): string {
  return localName.split("_")[0];
}

/** ローカル名から表示名を取り出す。 */
export function decodeDisplayName(localName: string): string {
  return localName.split("_").slice(1).join("_");
}

/** データURL(`data:…;base64,…`)から base64 部分だけを取り出す。データURLでなければそのまま返す。 */
export function extractBase64FromDataUrl(dataUrlOrBase64: string): string {
  const data = dataUrlOrBase64 || "";
  const m = data.match(/^data:(.*?);base64,(.*)$/);
  if (m) return m[2];
  return data;
}

/** MIME タイプと base64 から、データURLを作る。 */
export function toDataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

/** 保存先の1件のメタ情報を、画面・同期が扱う形(`DriveMetadata`)にする。 */
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
