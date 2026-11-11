/**
 * 設定>アセットの表(CSV)への対応。汎用の判断(差分・往復・エラー)は `@octopus/table-io` に任せ、ここは列と検証だけを持つ。
 *
 * - 列: `名前*, フォルダ`。名前は拡張子つきのファイル名で、素材の識別子(同じ名前 = 同じ素材)。
 *   フォルダは素材置き場直下のサブフォルダ名(1階層だけ。空 = 置き場直下)。
 * - 素材の中身は、CSV と一緒に選んだフォルダ(または ZIP の `media/`)から、名前と同じファイルを探す。
 *   新しい素材はファイルが必須。既存の素材は、ファイルが無ければ中身はそのまま(フォルダだけ変える)。
 * - 同じ名前の素材が複数あるときは、その名前の行はエラー(書き出しもできない)。
 */
import type { Header, Row, TableAdapter } from "@octopus/table-io";
import { storagePath, StorageKind, StorageModule } from "@octopus/infrastructures/compositions";
import { classifyMedia } from "@model/media/media-kind";
import { folderOf } from "@model/media/media-catalog";
import type { AssetRecordEntry } from "../../../server/scheduler-api-contract";

export const ASSET_CSV_NAME = "assets.csv";

/** 表の1行にあたる素材。`id` は素材の一覧の id、`hash` は中身のハッシュ。 */
export interface AssetItem {
  id: string;
  name: string;
  folder: string;
  mime: string;
  hash: string;
  size: number;
}

export const ASSET_HEADERS: readonly Header[] = [
  // `id` のキーが項目の識別子(planImport の約束)。素材はファイル名で見分けるので、名前の列をそれにする。
  { key: "id", label: "名前", aliases: ["name", "ファイル名", "素材名"], required: true, media: true },
  { key: "folder", label: "フォルダ", aliases: ["folder"] },
];

/** 素材置き場直下のサブフォルダ名の上限。 */
const MAX_FOLDER_LENGTH = 100;

/** フォルダ名の検査。使えなければ理由、使えれば null。 */
export function folderProblem(folder: string): string | null {
  if (folder === "") return null;
  if (/[\\/]/.test(folder)) return "フォルダは1階層だけです(/ や \\ は使えません)";
  if (folder === "." || folder === "..") return "フォルダ名に . や .. は使えません";
  if (folder.length > MAX_FOLDER_LENGTH) return `フォルダ名は${MAX_FOLDER_LENGTH}文字までです`;
  return null;
}

/** フォルダ名から素材の置き場所(`directoryId`)。空なら置き場直下(undefined)。 */
export const directoryOf = (folder: string): string | undefined =>
  folder ? storagePath(StorageModule.Scheduler, StorageKind.Assets, folder) : undefined;

/** 素材の一覧から表の素材にする。 */
export function toAssetItems(entries: readonly AssetRecordEntry[]): AssetItem[] {
  return entries.map((e) => ({ id: e.id, name: e.name, folder: folderOf(e.directoryId), mime: e.mime, hash: e.hash, size: e.size }));
}

/** 同じ名前の素材が複数ある名前。 */
export function duplicateNames(entries: readonly { name: string }[]): Set<string> {
  const count = new Map<string, number>();
  for (const e of entries) count.set(e.name, (count.get(e.name) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n > 1).map(([name]) => name));
}

/** 取込で入ってくるファイルの情報(名前 → 中身とハッシュ)。 */
export interface IncomingAsset {
  blob: Blob;
  hash: string;
}

export interface AssetAdapterOptions {
  /** 取込で選ばれたファイル(名前 → 中身とハッシュ)。書き出しでは渡さない。 */
  incoming?: ReadonlyMap<string, IncomingAsset>;
  /** 同じ名前の素材が複数ある名前。 */
  duplicates?: ReadonlySet<string>;
  /** 置き換えでも消さない素材の id(イベントが使っているもの)。 */
  protectedIds?: ReadonlySet<string>;
  newId?: () => string;
}

/** 素材の `TableAdapter`。 */
export function assetAdapter(options: AssetAdapterOptions = {}): TableAdapter<AssetItem> {
  const newId = options.newId ?? (() => crypto.randomUUID());
  return {
    csvName: ASSET_CSV_NAME,
    headers: ASSET_HEADERS,
    labelKey: "id",
    key: (a) => a.name,
    toRow: (a): Row => ({ id: a.name, folder: a.folder }),
    fromRow(row, existing) {
      const name = row.id ?? "";
      if (!name) return "名前が空です";
      if (/[\\/]/.test(name)) return "名前にフォルダは含められません(ファイル名だけ。フォルダは「フォルダ」の列)";
      if (options.duplicates?.has(name)) return `同名の素材が複数あります: ${name}`;
      const folder = row.folder ?? "";
      const problem = folderProblem(folder);
      if (problem) return problem;

      const file = options.incoming?.get(name);
      if (!existing && !file) return `ファイル「${name}」が見つかりません(CSV と一緒に素材のフォルダを選ぶか、ZIP の media/ に入れてください)`;
      const mime = file?.blob.type || existing?.mime || "";
      if (classifyMedia(mime, name) === "file") return `「${name}」は画像・音声・動画のファイルではありません`;
      return {
        id: existing?.id ?? newId(),
        name,
        folder,
        mime,
        hash: file?.hash ?? existing!.hash,
        size: file?.blob.size ?? existing!.size,
      };
    },
    protected: (a) => options.protectedIds?.has(a.id) === true,
  };
}
