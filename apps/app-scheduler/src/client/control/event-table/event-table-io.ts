/**
 * 設定>イベントの一括書き出し・取込を、画面の部品(ui-kit の `TableIoToolbar` / `TableImportDialog`)につなぐ。
 * 判断は `@octopus/table-io` の `planImport` と {@link ./event-table} に任せ、ここは
 * 「読む → 計画する(プレビュー)→ 素材の一覧を1回 → イベントを1回書く」という順序だけを受け持つ。状態は持たない。
 * 置き換えでも、設定>アセットの素材は消さない(消すのはイベントだけ)。
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
import { EVENT_CSV_NAME, eventAdapter, eventAssets } from "./event-table";
import type { EventAssetEntry } from "./event-table";

/** 書き出し・取込が使う素材の窓口(`AssetService` がそのまま満たす)。 */
export interface EventTableAssets {
  readEntries(): Promise<AssetRecordEntry[]>;
  blobOf(hash: string): Promise<Blob | null>;
  applyImport(files: readonly ImportedAsset[]): Promise<void>;
}

/** 書き出し・取込が使うイベントの窓口(`AppEventService` がそのまま満たす)。 */
export interface EventTableEvents {
  getScheduleEvents(): Promise<AppEvent[]>;
  applyImport(upserts: readonly AppEvent[], deleteIds: readonly string[]): Promise<void>;
}

export interface EventTableIoDeps {
  assets: EventTableAssets;
  events: EventTableEvents;
  /** 取込を確定したあとに呼ぶ(一覧の読み直しなど)。 */
  afterImport?: () => Promise<unknown>;
  /** 書き出しの注意(素材を含められなかったなど)。 */
  warn?: (message: string) => void;
  /** 書き出したファイルを渡す。既定はブラウザのダウンロード。 */
  save?: (file: FileToSave) => void;
  pool?: PoolOptions;
}

export interface EventExport extends FileToSave {
  /** 素材つきで頼まれたが、手元に無くて含められなかった素材の数。 */
  missingMedia: number;
}

/** イベントの素材の名前(音楽の音源・画像・動画)の id。 */
const mediaIdOf = (e: AppEvent): string | null =>
  e.type === "AudioEvent" ? e.audioId : e.type === "ScreenEvent" && e.spec.kind !== "slideshow" ? e.spec.id : null;

/** イベントを書き出す。素材つきなら、使われている素材を1つずつ(同じ名前は1回だけ)`media/<名前>` に入れる。 */
export async function exportEvents(deps: Pick<EventTableIoDeps, "assets" | "events" | "pool">, options: { includeMedia: boolean }): Promise<EventExport> {
  const [events, entries] = await Promise.all([deps.events.getScheduleEvents(), deps.assets.readEntries()]);
  const csv = exportTable(events, eventAdapter(eventAssets(entries)));
  if (!options.includeMedia) return { filename: EVENT_CSV_NAME, mime: "text/csv;charset=utf-8", bytes: new TextEncoder().encode(csv), missingMedia: 0 };
  const used = new Set(events.map(mediaIdOf).filter((id): id is string => id !== null));
  const found = await mapPool(
    entries.filter((e) => used.has(e.id)),
    async (e) => {
      const blob = await deps.assets.blobOf(e.hash);
      return blob ? ([e.name, new Uint8Array(await blob.arrayBuffer())] as const) : null;
    },
    deps.pool
  );
  const files = found.filter((f) => f !== null);
  return { filename: "events.zip", mime: "application/zip", bytes: buildZip(EVENT_CSV_NAME, csv, files), missingMedia: found.length - files.length };
}

/** 取込に渡す入力: CSV または書き出した ZIP と、素材のフォルダで選んだファイル、取込のモード。 */
export interface EventImportInput {
  table: File;
  media: readonly File[];
  mode: ImportMode;
}

/** 選んだファイルを読み、計画を立てる(まだ何も書かない)。確定する関数 `apply` を抱えて返る。 */
export async function previewEventImport(input: EventImportInput, deps: EventTableIoDeps) {
  const read = await readImportFiles(input.table, input.media);
  if (!read.ok) return read;
  const { csv, files } = read.value;

  const parsed = parseTable(csv, eventAdapter(eventAssets([])).headers);
  if (!parsed.ok) return parsed;

  // CSV が指していて、選ばれたファイルにある素材だけ、ハッシュを並列に計算する。
  const referenced = referencedMedia(parsed, files);
  const [events, entries, hashes] = await Promise.all([
    deps.events.getScheduleEvents(),
    deps.assets.readEntries(),
    mapPool(referenced, async (name) => [name, await hashBlob(files.get(name)!)] as const, deps.pool),
  ]);

  // 素材の取り込み: 一覧に同じ名前が1つだけあれば、中身が違うときに同じ id のまま差し替え。無ければ新しい素材。同名が複数あれば触らない(行のエラーになる)。
  const idsByName = new Map<string, AssetRecordEntry[]>();
  for (const e of entries) idsByName.set(e.name, [...(idsByName.get(e.name) ?? []), e]);
  const candidates: { asset: ImportedAsset; replaced: boolean }[] = [];
  for (const [name, hash] of hashes) {
    const same = idsByName.get(name) ?? [];
    if (same.length > 1) continue;
    const blob = files.get(name)!;
    if (same.length === 0) candidates.push({ asset: { id: crypto.randomUUID(), name, blob, hash }, replaced: false });
    else if (same[0].hash !== hash) candidates.push({ asset: { id: same[0].id, name, blob, hash }, replaced: true });
  }
  // 差し替える(または新しく入る)素材を参照している行は、文字列が同じでも更新になる。
  const changed = new Set(candidates.map((c) => c.asset.name));

  const known = new Set(entries.map((e) => e.id));
  const listed: EventAssetEntry[] = [...entries, ...candidates.filter((c) => !known.has(c.asset.id)).map((c) => ({ id: c.asset.id, name: c.asset.name, mime: c.asset.blob.type }))];
  const plan = planImport(events, parsed.rows, eventAdapter(eventAssets(listed)), input.mode, changed);

  // 取り込んだあとのイベントが使っている素材だけを入れる(CSV に書いてあっても、使わない行の素材は入れない)。
  const usedIds = new Set(plan.next.map(mediaIdOf));
  const imports = plan.ok ? candidates.filter((c) => usedIds.has(c.asset.id)) : candidates;
  const media = { added: imports.filter((c) => !c.replaced).length, replaced: imports.filter((c) => c.replaced).length };

  return {
    ok: true as const,
    rows: plan.rows,
    counts: plan.counts,
    media,
    apply: async (onProgress: (message: string) => void) => {
      if (!plan.ok) throw new Error("エラーの行があるため取り込めません");
      onProgress("素材を保存しています");
      await deps.assets.applyImport(imports.map((c) => c.asset));
      onProgress("イベントを更新しています");
      await deps.events.applyImport(plan.upserts, plan.deletes.map((e) => e.id));
      await deps.afterImport?.();
      const c = plan.counts;
      return {
        summary: `追加 ${c.add} / 更新 ${c.update} / 変更なし ${c.unchanged} / 削除 ${c.delete}`,
        details: [`素材: 追加 ${media.added} / 差し替え ${media.replaced}`],
      };
    },
  };
}

/** イベント一覧の画面が使う、`onExport`(CSVダウンロード)と `onPreviewImport`(取込のプレビュー)を作る。 */
export function eventTableIo(deps: EventTableIoDeps) {
  return {
    async onExport(options: { includeMedia: boolean }): Promise<void> {
      const out = await exportEvents(deps, options);
      (deps.save ?? saveFile)(out);
      if (out.missingMedia > 0) deps.warn?.(`${out.missingMedia}件の素材を取得できず、含めていません`);
    },
    onPreviewImport: (input: EventImportInput) => previewEventImport(input, deps),
  };
}
