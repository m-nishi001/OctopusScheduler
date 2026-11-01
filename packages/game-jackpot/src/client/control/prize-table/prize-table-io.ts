/**
 * 景品の一括書き出し・取込を、画面の部品(ui-kit の `TableIoToolbar` / `TableImportDialog`)につなぐ。
 * 判断は `@octopus/table-io` の `planImport` と {@link ./prize-table} に任せ、ここは
 * 「読む → 計画する(プレビュー)→ レコードを1回だけ書く」という順序だけを受け持つ。状態は持たない。
 */
import { saveFile } from "@octopus/client-common/blob/save-file";
import type { FileToSave } from "@octopus/client-common/blob/save-file";
import { hashBlob, mapPool } from "@octopus/sync-engine";
import type { PoolOptions } from "@octopus/sync-engine";
import { buildZip, diffMedia, exportTable, parseTable, planImport, readImportFiles, referencedMedia } from "@octopus/table-io";
import type { ImportMode } from "@octopus/table-io";
import type { JackpotRecord, Prize } from "../../../server/jackpot-api-contract";
import type { ImportedFile } from "../../model/jackpot-repository";
import { orderImportedPrizes, PRIZE_CSV_NAME, PRIZE_HEADERS, prizeAdapter } from "./prize-table";

/** 書き出し・取込が使う景品の窓口(`JackpotRepository` がそのまま満たす)。 */
export interface PrizeTableRepository {
  readRecord(): Promise<JackpotRecord>;
  blobOf(name: string): Promise<Blob | null>;
  applyPrizeImport(next: readonly Prize[], newFiles: ReadonlyMap<string, ImportedFile>): Promise<void>;
}

export interface PrizeTableIoDeps {
  repo: PrizeTableRepository;
  /** 取込を確定したあとに呼ぶ(一覧の読み直しなど)。 */
  afterImport?: () => Promise<unknown>;
  /** 書き出しの注意(素材を含められなかったなど)。 */
  warn?: (message: string) => void;
  /** 書き出したファイルを渡す。既定はブラウザのダウンロード。 */
  save?: (file: FileToSave) => void;
  pool?: PoolOptions;
}

export interface PrizeExport extends FileToSave {
  /** 素材つきで頼まれたが、手元に無くて含められなかった素材の数。 */
  missingMedia: number;
}

/** 景品を並び順に書き出す。素材つきなら、参照されている素材を1つずつ(同じ名前は1回だけ)ZIP に入れる。 */
export async function exportPrizes(repo: PrizeTableRepository, options: { includeMedia: boolean }, pool?: PoolOptions): Promise<PrizeExport> {
  const { prizes, media } = await repo.readRecord();
  const csv = exportTable([...prizes].sort((a, b) => a.order - b.order), prizeAdapter());
  if (!options.includeMedia) return { filename: PRIZE_CSV_NAME, mime: "text/csv;charset=utf-8", bytes: new TextEncoder().encode(csv), missingMedia: 0 };
  const found = await mapPool(
    Object.keys(media),
    async (name) => {
      const blob = await repo.blobOf(name);
      return blob ? ([name, new Uint8Array(await blob.arrayBuffer())] as const) : null;
    },
    pool
  );
  const files = found.filter((f) => f !== null);
  return { filename: "prizes.zip", mime: "application/zip", bytes: buildZip(PRIZE_CSV_NAME, csv, files), missingMedia: found.length - files.length };
}

/** 取込に渡す入力: CSV または書き出した ZIP と、素材のフォルダで選んだファイル、取込のモード。 */
export interface PrizeImportInput {
  table: File;
  media: readonly File[];
  mode: ImportMode;
}

/** 選んだファイルを読み、計画を立てる(まだ何も書かない)。確定する関数 `apply` を抱えて返る。 */
export async function previewPrizeImport(input: PrizeImportInput, deps: PrizeTableIoDeps) {
  const read = await readImportFiles(input.table, input.media);
  if (!read.ok) return read;
  const { csv, files } = read.value;

  const parsed = parseTable(csv, PRIZE_HEADERS);
  if (!parsed.ok) return parsed;

  // CSV が指していて、選ばれたファイルにある素材だけ、ハッシュを並列に計算する。
  const [record, hashes] = await Promise.all([
    deps.repo.readRecord(),
    mapPool(referencedMedia(parsed, files), async (name) => [name, await hashBlob(files.get(name)!)] as const, deps.pool),
  ]);
  const incoming = new Map(hashes);
  const diff = diffMedia(Object.fromEntries(Object.entries(record.media).map(([name, m]) => [name, m.hash])), incoming);
  // 差し替える(または新しく入る)素材を参照している行は、文字列が同じでも更新になる。
  const changed = new Set([...diff.added, ...diff.replaced]);

  const adapter = prizeAdapter({ available: new Set([...Object.keys(record.media), ...files.keys()]) });
  const plan = planImport(record.prizes, parsed.rows, adapter, input.mode, changed);

  return {
    ok: true as const,
    rows: plan.rows,
    counts: plan.counts,
    media: { added: diff.added.length, replaced: diff.replaced.length },
    apply: async (onProgress: (message: string) => void) => {
      if (!plan.ok) throw new Error("エラーの行があるため取り込めません");
      onProgress("景品を更新しています");
      const newFiles = new Map([...changed].map((name) => [name, { blob: files.get(name)!, hash: incoming.get(name)! }] as const));
      await deps.repo.applyPrizeImport(orderImportedPrizes(plan, input.mode), newFiles);
      await deps.afterImport?.();
      const c = plan.counts;
      return {
        summary: `追加 ${c.add} / 更新 ${c.update} / 変更なし ${c.unchanged} / 削除 ${c.delete}`,
        details: [`素材: 追加 ${diff.added.length} / 差し替え ${diff.replaced.length}`],
      };
    },
  };
}

/** 景品の画面が使う、`onExport`(CSVダウンロード)と `onPreviewImport`(取込のプレビュー)を作る。 */
export function prizeTableIo(deps: PrizeTableIoDeps) {
  return {
    async onExport(options: { includeMedia: boolean }): Promise<void> {
      const out = await exportPrizes(deps.repo, options, deps.pool);
      (deps.save ?? saveFile)(out);
      if (out.missingMedia > 0) deps.warn?.(`${out.missingMedia}件の素材を取得できず、含めていません`);
    },
    onPreviewImport: (input: PrizeImportInput) => previewPrizeImport(input, deps),
  };
}
