import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

/**
 * ジャックポットのローカルバックアップ。
 *
 * このブラウザに保存してあるデータ（IndexedDB の `jackpot-game`）を1つの JSON にして書き出す。
 * 以前は localStorage の `jackpot-` で始まるキーだけを書き出していたため、実際のデータ（景品・メンバーの設定・
 * 画面設定・抽選結果・アセット）は1つも入らず、ほぼ空のファイルだった。
 */

/** 常に書き出すストア（ストア名 → 内容）。抽選結果と確変の予定はセッションの結果ファイル（サーバー）にあり、ここには無い。 */
export const BACKUP_STORES = ["PrizeData", "MemberExtraData", "ScreenConfigData"] as const;
/** `includeAssets` のときだけ書き出すストア（画像・音声などの中身を含むため大きい）。 */
export const BACKUP_ASSET_STORE = "AssetData";

const DB_NAME = "jackpot-game";

export interface LocalBackup {
  exportedAt: string;
  includeAssets: boolean;
  /** ストア名 → (キー → 保存されている値)。Blob は `{ __blob: true, type, dataUrl }` に直してある。 */
  stores: Record<string, Record<string, unknown>>;
}

/** JSON にできない Blob を、中身ごと（データURLで）持てる形に直す。入れ子の中も辿る。 */
export async function toJsonSafe(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    return { __blob: true, type: value.type, dataUrl: await blobToDataUrl(value) };
  }
  if (Array.isArray(value)) return Promise.all(value.map(toJsonSafe));
  if (value !== null && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await toJsonSafe(v)] as const));
    return Object.fromEntries(entries);
  }
  return value;
}

/** ストアの中身を、キー順に読み出す。 */
async function readStore(storeName: string): Promise<Record<string, unknown>> {
  const all = await new LocalStorageService(DB_NAME, storeName).getAll<unknown>();
  const out: Record<string, unknown> = {};
  for (const key of Array.from(all.keys()).sort()) out[key] = await toJsonSafe(all.get(key));
  return out;
}

/** バックアップの内容を作る（ダウンロードはしない）。 */
export async function buildLocalBackup(includeAssets = true): Promise<LocalBackup> {
  const names: string[] = [...BACKUP_STORES, ...(includeAssets ? [BACKUP_ASSET_STORE] : [])];
  const stores: Record<string, Record<string, unknown>> = {};
  for (const name of names) stores[name] = await readStore(name);
  return { exportedAt: new Date().toISOString(), includeAssets, stores };
}

/**
 * バックアップを JSON ファイルとしてダウンロードする。
 * @returns ファイル名と大きさ(バイト)
 */
export async function exportLocalBackup(includeAssets = true): Promise<{ filename: string; size: number }> {
  const backup = await buildLocalBackup(includeAssets);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const filename = `jackpot-backup-${backup.exportedAt}.json`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { filename, size: blob.size };
}
