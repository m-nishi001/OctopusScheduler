/**
 * 設定>アセットの一括書き出し・取込を、画面の部品(ui-kit の `TableIoToolbar` / `TableImportDialog`)につなぐ。
 * 判断は `@octopus/table-io` の `planImport` と {@link ./asset-table} に任せ、ここは
 * 「読む → 計画する(プレビュー)→ 素材の一覧を1回書く → 置き換えなら消す」という順序だけを受け持つ。状態は持たない。
 * 置き換えでも、イベントが使っている素材は消さない。
 */
import { saveFile } from "@octopus/client-common/blob/save-file";
import type { FileToSave } from "@octopus/client-common/blob/save-file";
import { hashBlob, mapPool } from "@octopus/sync-engine";
import type { PoolOptions } from "@octopus/sync-engine";
import { buildZip, exportTable, parseTable, planImport, readImportFiles, referencedMedia } from "@octopus/table-io";
import type { ImportMode } from "@octopus/table-io";
import type { AssetRecordEntry } from "../../../server/scheduler-api-contract";
import type { ImportedAsset } from "@model/asset/asset-repository";
import type { AppEvent } from "../app-event/app-event";
import { ASSET_CSV_NAME, assetAdapter, directoryOf, duplicateNames, toAssetItems } from "./asset-table";
import type { IncomingAsset } from "./asset-table";

/** 書き出し・取込が使う素材の窓口(`AssetService` がそのまま満たす)。 */
export interface AssetTableAssets {
  readEntries(): Promise<AssetRecordEntry[]>;
  blobOf(hash: string): Promise<Blob | null>;
  applyImport(files: readonly ImportedAsset[], directories?: ReadonlyMap<string, string | undefined>): Promise<void>;
  deleteAssets(ids: string[]): Promise<void>;
}

/** 置き換えで素材を消してよいか決めるために、イベントが使っている素材を知る窓口(`AppEventService` が満たす)。 */
export interface AssetTableEvents {
  getScheduleEvents(): Promise<AppEvent[]>;
}

export interface AssetTableIoDeps {
  assets: AssetTableAssets;
  events: AssetTableEvents;
  afterImport?: () => Promise<unknown>;
  warn?: (message: string) => void;
  save?: (file: FileToSave) => void;
  pool?: PoolOptions;
}

export interface AssetExport extends FileToSave {
  /** 素材つきで頼まれたが、手元に無くて含められなかった素材の数。 */
  missingMedia: number;
}

/** イベントが使っている素材の id。 */
const usedByEvents = (events: readonly AppEvent[]): Set<string> => {
  const ids = new Set<string>();
  for (const e of events) {
    if (e.type === "AudioEvent") ids.add(e.audioId);
    else if (e.type === "ScreenEvent" && e.spec.kind !== "slideshow") ids.add(e.spec.id);
  }
  return ids;
};

/** 素材を書き出す。素材つきなら `media/<名前>` に中身を入れる。同じ名前の素材が複数あれば書き出せない(取り込めない形になるため)。 */
export async function exportAssets(deps: Pick<AssetTableIoDeps, "assets" | "pool">, options: { includeMedia: boolean }): Promise<AssetExport> {
  const entries = await deps.assets.readEntries();
  const duplicates = duplicateNames(entries);
  if (duplicates.size > 0) throw new Error(`同じ名前の素材があるため書き出せません: ${[...duplicates].join("、")}(アセットの一覧から消してください)`);
  const csv = exportTable(toAssetItems(entries), assetAdapter());
  if (!options.includeMedia) return { filename: ASSET_CSV_NAME, mime: "text/csv;charset=utf-8", bytes: new TextEncoder().encode(csv), missingMedia: 0 };
  const found = await mapPool(
    entries,
    async (e) => {
      const blob = await deps.assets.blobOf(e.hash);
      return blob ? ([e.name, new Uint8Array(await blob.arrayBuffer())] as const) : null;
    },
    deps.pool
  );
  const files = found.filter((f) => f !== null);
  return { filename: "assets.zip", mime: "application/zip", bytes: buildZip(ASSET_CSV_NAME, csv, files), missingMedia: found.length - files.length };
}

/** 取込に渡す入力: CSV または書き出した ZIP と、素材のフォルダで選んだファイル、取込のモード。 */
export interface AssetImportInput {
  table: File;
  media: readonly File[];
  mode: ImportMode;
}

/** 選んだファイルを読み、計画を立てる(まだ何も書かない)。確定する関数 `apply` を抱えて返る。 */
export async function previewAssetImport(input: AssetImportInput, deps: AssetTableIoDeps) {
  const read = await readImportFiles(input.table, input.media);
  if (!read.ok) return read;
  const { csv, files } = read.value;

  const headers = assetAdapter().headers;
  const parsed = parseTable(csv, headers);
  if (!parsed.ok) return parsed;

  // CSV が指していて、選ばれたファイルにある素材だけ、ハッシュを並列に計算する。
  const referenced = referencedMedia(parsed, files);
  const [entries, events, hashes] = await Promise.all([
    deps.assets.readEntries(),
    deps.events.getScheduleEvents(),
    mapPool(referenced, async (name) => [name, await hashBlob(files.get(name)!)] as const, deps.pool),
  ]);
  const incoming = new Map<string, IncomingAsset>(hashes.map(([name, hash]) => [name, { blob: files.get(name)!, hash }] as const));

  const current = toAssetItems(entries);
  const hashOf = new Map(current.map((a) => [a.name, a.hash] as const));
  // 中身が新しい(または違う)素材の名前。これを参照している行は、文字列が同じでも更新になる。
  const changed = new Set([...incoming].filter(([name, f]) => hashOf.get(name) !== f.hash).map(([name]) => name));

  const plan = planImport(
    current,
    parsed.rows,
    assetAdapter({ incoming, duplicates: duplicateNames(entries), protectedIds: usedByEvents(events) }),
    input.mode,
    changed
  );
  const protectedCount = input.mode === "replace" && plan.ok ? entries.filter((e) => usedByEvents(events).has(e.id) && !parsed.rows.some((r) => r.cells.id === e.name)).length : 0;

  return {
    ok: true as const,
    rows: plan.rows,
    counts: plan.counts,
    media: { added: [...changed].filter((n) => !hashOf.has(n)).length, replaced: [...changed].filter((n) => hashOf.has(n)).length },
    apply: async (onProgress: (message: string) => void) => {
      if (!plan.ok) throw new Error("エラーの行があるため取り込めません");
      onProgress("素材を保存しています");
      const files: ImportedAsset[] = [];
      const directories = new Map<string, string | undefined>();
      for (const item of plan.upserts) {
        const file = incoming.get(item.name);
        if (file && changed.has(item.name)) files.push({ id: item.id, name: item.name, blob: file.blob, hash: file.hash });
        directories.set(item.id, directoryOf(item.folder));
      }
      await deps.assets.applyImport(files, directories);
      if (plan.deletes.length > 0) {
        onProgress("ファイルに無い素材を削除しています");
        await deps.assets.deleteAssets(plan.deletes.map((a) => a.id));
      }
      await deps.afterImport?.();
      const c = plan.counts;
      return {
        summary: `追加 ${c.add} / 更新 ${c.update} / 変更なし ${c.unchanged} / 削除 ${c.delete}`,
        details: protectedCount > 0 ? [`イベントが使っている素材 ${protectedCount} 件は、ファイルに無くても削除していません`] : [],
      };
    },
  };
}

/** アセット一覧の画面が使う、`onExport`(ダウンロード)と `onPreviewImport`(取込のプレビュー)を作る。 */
export function assetTableIo(deps: AssetTableIoDeps) {
  return {
    async onExport(options: { includeMedia: boolean }): Promise<void> {
      const out = await exportAssets(deps, options);
      (deps.save ?? saveFile)(out);
      if (out.missingMedia > 0) deps.warn?.(`${out.missingMedia}件の素材を取得できず、含めていません`);
    },
    onPreviewImport: (input: AssetImportInput) => previewAssetImport(input, deps),
  };
}
