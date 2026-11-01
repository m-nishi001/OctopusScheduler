import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

/**
 * ジャックポットのローカルバックアップ。
 *
 * このブラウザに保存してあるデータ（IndexedDB の `jackpot-game`）を1つの JSON にして書き出す。
 * 以前は localStorage の `jackpot-` で始まるキーだけを書き出していたため、実際のデータ（景品・メンバーの設定・
 * 画面設定）は1つも入らず、ほぼ空のファイルだった。素材（画像・音声）の中身は含めない（レコードの索引だけ）。
 */

/**
 * 書き出すストア（ストア名 → 内容）。景品と画面設定（と素材の索引）・メンバーの設定は、全体を `record` というキー1つに
 * `{ data: 全体, updatedAt: 最終更新日時 }` の形で持つ（同期の単位）。抽選結果と確変の予定はセッションの結果ファイル（サーバー）にあり、ここには無い。 */
export const BACKUP_STORES = ["JackpotData", "MemberExtraData"] as const;

const DB_NAME = "jackpot-game";

export interface LocalBackup {
  exportedAt: string;
  /** ストア名 → (キー → 保存されている値。`record` のみ)。Blob は `{ __blob: true, type, dataUrl }` に直してある。 */
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
export async function buildLocalBackup(): Promise<LocalBackup> {
  const stores: Record<string, Record<string, unknown>> = {};
  for (const name of BACKUP_STORES) stores[name] = await readStore(name);
  return { exportedAt: new Date().toISOString(), stores };
}

/**
 * バックアップを JSON ファイルとしてダウンロードする。
 * @returns ファイル名と大きさ(バイト)
 */
export async function exportLocalBackup(): Promise<{ filename: string; size: number }> {
  const backup = await buildLocalBackup();
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
