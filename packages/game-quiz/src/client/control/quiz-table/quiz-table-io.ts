/**
 * クイズ一覧の一括書き出し・取込を、画面の部品(ui-kit の `TableIoToolbar` / `TableImportDialog`)につなぐ。
 * 判断は `@octopus/table-io` の `planImport` と {@link ./quiz-table} に任せ、ここは
 * 「読む → 計画する(プレビュー)→ 一覧を1回だけ書く」という順序だけを受け持つ。状態は持たない。
 */
import { saveFile } from "@octopus/client-common/blob/save-file";
import type { FileToSave } from "@octopus/client-common/blob/save-file";
import { hashBlob, mapPool } from "@octopus/sync-engine";
import type { PoolOptions } from "@octopus/sync-engine";
import { buildZip, diffMedia, exportTable, parseTable, planImport, readImportFiles, referencedMedia } from "@octopus/table-io";
import type { ImportMode } from "@octopus/table-io";
import type { QuizRecord } from "../../../server/quiz-api-contract";
import type { ImportedFile } from "../../model/quiz-repository";
import { headerOptionCount, maxOptionNo, QUIZ_CSV_NAME, quizAdapter, quizHeadersFromNames } from "./quiz-table";

/** 書き出し・取込が使うクイズの窓口(`QuizRepository` がそのまま満たす)。 */
export interface QuizTableRepository {
  readRecord(): Promise<QuizRecord>;
  blobOf(hash: string): Promise<Blob | null>;
  applyImport: (next: QuizRecord["quizzes"], newFiles: ReadonlyMap<string, ImportedFile>) => Promise<void>;
}

export interface QuizTableIoDeps {
  repo: QuizTableRepository;
  /** 取込を確定したあとに呼ぶ(一覧の読み直しなど)。 */
  afterImport?: () => Promise<unknown>;
  /** 書き出しの注意(素材を含められなかったなど)。 */
  warn?: (message: string) => void;
  /** 書き出したファイルを渡す。既定はブラウザのダウンロード。 */
  save?: (file: FileToSave) => void;
  pool?: PoolOptions;
}

export interface QuizExport extends FileToSave {
  /** 素材つきで頼まれたが、手元に無くて含められなかった素材の数。 */
  missingMedia: number;
}

/** クイズ一覧を書き出す。素材つきなら、参照されている素材を1つずつ(同じ名前は1回だけ)ZIP に入れる。 */
export async function exportQuizzes(repo: QuizTableRepository, options: { includeMedia: boolean }, pool?: PoolOptions): Promise<QuizExport> {
  const { quizzes, media } = await repo.readRecord();
  const csv = exportTable(quizzes, quizAdapter({ optionCount: maxOptionNo(quizzes) }));
  if (!options.includeMedia) return { filename: QUIZ_CSV_NAME, mime: "text/csv;charset=utf-8", bytes: new TextEncoder().encode(csv), missingMedia: 0 };
  const found = await mapPool(
    Object.entries(media),
    async ([name, info]) => {
      const blob = await repo.blobOf(info.hash);
      return blob ? ([name, new Uint8Array(await blob.arrayBuffer())] as const) : null;
    },
    pool
  );
  const files = found.filter((f) => f !== null);
  return { filename: "quizzes.zip", mime: "application/zip", bytes: buildZip(QUIZ_CSV_NAME, csv, files), missingMedia: found.length - files.length };
}

/** 取込に渡す入力: CSV または書き出した ZIP と、素材のフォルダで選んだファイル、取込のモード。 */
export interface QuizImportInput {
  table: File;
  media: readonly File[];
  mode: ImportMode;
}

/** 選んだファイルを読み、計画を立てる(まだ何も書かない)。確定する関数 `apply` を抱えて返る。 */
export async function previewQuizImport(input: QuizImportInput, deps: QuizTableIoDeps) {
  const read = await readImportFiles(input.table, input.media);
  if (!read.ok) return read;
  const { csv, files } = read.value;

  const parsed = parseTable(csv, quizHeadersFromNames);
  if (!parsed.ok) return parsed;

  // CSV が指していて、選ばれたファイルにある素材だけ、ハッシュを並列に計算する。
  const referenced = referencedMedia(parsed, files);
  const [record, hashes] = await Promise.all([
    deps.repo.readRecord(),
    mapPool(referenced, async (name) => [name, await hashBlob(files.get(name)!)] as const, deps.pool),
  ]);
  const incoming = new Map(hashes);
  const diff = diffMedia(Object.fromEntries(Object.entries(record.media).map(([name, m]) => [name, m.hash])), incoming);
  // 差し替える(または新しく入る)素材を参照している行は、文字列が同じでも更新になる。
  const changed = new Set([...diff.added, ...diff.replaced]);

  const adapter = quizAdapter({
    optionCount: Math.max(headerOptionCount(parsed.headers), maxOptionNo(record.quizzes)),
    available: new Set([...Object.keys(record.media), ...files.keys()]),
  });
  const plan = planImport(record.quizzes, parsed.rows, adapter, input.mode, changed);

  return {
    ok: true as const,
    rows: plan.rows,
    counts: plan.counts,
    media: { added: diff.added.length, replaced: diff.replaced.length },
    apply: async (onProgress: (message: string) => void) => {
      if (!plan.ok) throw new Error("エラーの行があるため取り込めません");
      onProgress("クイズを更新しています");
      const newFiles = new Map([...changed].map((name) => [name, { blob: files.get(name)!, hash: incoming.get(name)! }] as const));
      await deps.repo.applyImport(plan.next, newFiles);
      await deps.afterImport?.();
      const c = plan.counts;
      return {
        summary: `追加 ${c.add} / 更新 ${c.update} / 変更なし ${c.unchanged} / 削除 ${c.delete}`,
        details: [`素材: 追加 ${diff.added.length} / 差し替え ${diff.replaced.length}`],
      };
    },
  };
}

/** クイズ一覧の画面が使う、`onExport`(CSVダウンロード)と `onPreviewImport`(取込のプレビュー)を作る。 */
export function quizTableIo(deps: QuizTableIoDeps) {
  return {
    async onExport(options: { includeMedia: boolean }): Promise<void> {
      const out = await exportQuizzes(deps.repo, options, deps.pool);
      (deps.save ?? saveFile)(out);
      if (out.missingMedia > 0) deps.warn?.(`${out.missingMedia}件の素材を取得できず、含めていません`);
    },
    onPreviewImport: (input: QuizImportInput) => previewQuizImport(input, deps),
  };
}
