/**
 * ジャックポット画面設定の一括書き出し・取込を、画面の部品(ui-kit の `TableIoToolbar` / `TableImportDialog`)につなぐ。
 * 判断は {@link ./screen-table} の純粋関数に任せ、ここは「読む → 計画する(プレビュー)→ 画面設定を1回書く」という順序だけを受け持つ。状態は持たない。
 * ファイルに出てくる画面だけを、まるごと置き換える(置き換えモードは無い)。
 */
import { saveFile } from "@octopus/client-common/blob/save-file";
import type { FileToSave } from "@octopus/client-common/blob/save-file";
import { hashBlob, mapPool } from "@octopus/sync-engine";
import type { PoolOptions } from "@octopus/sync-engine";
import { buildZip, diffMedia, readImportFiles, referencedMedia, stringifyTable } from "@octopus/table-io";
import type { ImportMode, Row } from "@octopus/table-io";
import type { JackpotRecord, ScreenSettingRecord } from "../../../server/jackpot-api-contract";
import { parseScreenCsv, rowsToScreens, rowText, SCREEN_CSV_NAME, SCREEN_HEADERS, screensToRows } from "./screen-table";

/** 書き出し・取込が使う画面設定の窓口(`JackpotRepository` がそのまま満たす)。 */
export interface ScreenTableRepository {
  readRecord(): Promise<JackpotRecord>;
  blobOf(name: string): Promise<Blob | null>;
  updateScreenSettings(settings: readonly ScreenSettingRecord[], files?: ReadonlyMap<string, Blob>): Promise<void>;
}

export interface ScreenTableIoDeps {
  repo: ScreenTableRepository;
  afterImport?: () => Promise<unknown>;
  warn?: (message: string) => void;
  save?: (file: FileToSave) => void;
  pool?: PoolOptions;
}

export interface ScreenExport extends FileToSave {
  missingMedia: number;
}

/** 行が参照している素材の名前(重複なし)。 */
const mediaNamesOf = (rows: readonly Row[]): string[] => [...new Set(rows.flatMap((r) => [r.media, r.se]).filter((n): n is string => !!n))];

/** 画面設定を書き出す。素材つきなら、参照されている素材を1つずつ ZIP の `media/` に入れる。 */
export async function exportScreens(repo: ScreenTableRepository, options: { includeMedia: boolean }, pool?: PoolOptions): Promise<ScreenExport> {
  const { screens } = await repo.readRecord();
  const rows = screensToRows(screens);
  const csv = stringifyTable(SCREEN_HEADERS, rows);
  if (!options.includeMedia) return { filename: SCREEN_CSV_NAME, mime: "text/csv;charset=utf-8", bytes: new TextEncoder().encode(csv), missingMedia: 0 };
  const found = await mapPool(
    mediaNamesOf(rows),
    async (name) => {
      const blob = await repo.blobOf(name);
      return blob ? ([name, new Uint8Array(await blob.arrayBuffer())] as const) : null;
    },
    pool
  );
  const files = found.filter((f) => f !== null);
  return { filename: "screens.zip", mime: "application/zip", bytes: buildZip(SCREEN_CSV_NAME, csv, files), missingMedia: found.length - files.length };
}

/** 取込に渡す入力。置き換えモードは無いので `mode` は使わない。 */
export interface ScreenImportInput {
  table: File;
  media: readonly File[];
  mode: ImportMode;
}

/** 選んだファイルを読み、計画を立てる(まだ何も書かない)。確定する関数 `apply` を抱えて返る。 */
export async function previewScreenImport(input: ScreenImportInput, deps: ScreenTableIoDeps) {
  const read = await readImportFiles(input.table, input.media);
  if (!read.ok) return read;
  const { csv, files } = read.value;

  const parsed = parseScreenCsv(csv);
  if (!parsed.ok) return parsed;

  const [record, hashes] = await Promise.all([
    deps.repo.readRecord(),
    mapPool(referencedMedia(parsed, files), async (name) => [name, await hashBlob(files.get(name)!)] as const, deps.pool),
  ]);
  const incoming = new Map(hashes);
  const diff = diffMedia(Object.fromEntries(Object.entries(record.media).map(([name, m]) => [name, m.hash])), incoming);
  const changedMedia = new Set([...diff.added, ...diff.replaced]);

  const plan = rowsToScreens(parsed.rows.map((r) => r.cells), {
    available: new Set([...Object.keys(record.media), ...files.keys()]),
    mimeOf: (name) => files.get(name)?.type || record.media[name]?.mime || "",
  });

  // 画面ごとに、ファイルの内容といまの内容を比べる(行の文字列が同じで、差し替える素材も使わなければ、変更なし)。
  const rowsOf = (records: readonly ScreenSettingRecord[], settingName: string): Row[] => screensToRows(records.filter((r) => r.settingName === settingName));
  const status = new Map<string, "add" | "update" | "unchanged">();
  for (const next of plan.records) {
    const current = record.screens.find((s) => s.settingName === next.settingName);
    const nextRows = rowsOf([next], next.settingName);
    const same =
      !!current &&
      JSON.stringify(nextRows.map(rowText)) === JSON.stringify(rowsOf(record.screens, next.settingName).map(rowText)) &&
      !mediaNamesOf(nextRows).some((n) => changedMedia.has(n));
    status.set(next.settingName, !current ? "add" : same ? "unchanged" : "update");
  }

  const rows = parsed.rows.map((r, i) => {
    const settingName = plan.screenOfRow[i];
    const error = plan.errors[i];
    const label = [r.cells.screen, r.cells.item].filter(Boolean).join(" ");
    return error
      ? { line: r.line, key: String(i), label, status: "error" as const, message: error }
      : { line: r.line, key: String(i), label, status: status.get(settingName ?? "") ?? ("unchanged" as const) };
  });
  const counts = { add: 0, update: 0, unchanged: 0, delete: 0, error: 0 };
  for (const r of rows) counts[r.status]++;
  const ok = counts.error === 0;

  return {
    ok: true as const,
    rows,
    counts,
    media: { added: diff.added.length, replaced: diff.replaced.length },
    apply: async (onProgress: (message: string) => void) => {
      if (!ok) throw new Error("エラーの行があるため取り込めません");
      onProgress("画面設定を更新しています");
      const changed = plan.records.filter((s) => status.get(s.settingName) !== "unchanged");
      const newFiles = new Map([...changedMedia].map((name) => [name, files.get(name)!] as const));
      if (changed.length > 0) await deps.repo.updateScreenSettings(changed, newFiles);
      await deps.afterImport?.();
      const c = counts;
      return {
        summary: `追加 ${c.add} / 更新 ${c.update} / 変更なし ${c.unchanged}`,
        details: [`置き換えた画面: ${changed.length} / 素材: 追加 ${diff.added.length} / 差し替え ${diff.replaced.length}`],
      };
    },
  };
}

/** 画面設定の画面が使う、`onExport`(ダウンロード)と `onPreviewImport`(取込のプレビュー)を作る。 */
export function screenTableIo(deps: ScreenTableIoDeps) {
  return {
    async onExport(options: { includeMedia: boolean }): Promise<void> {
      const out = await exportScreens(deps.repo, options, deps.pool);
      (deps.save ?? saveFile)(out);
      if (out.missingMedia > 0) deps.warn?.(`${out.missingMedia}件の素材を取得できず、含めていません`);
    },
    onPreviewImport: (input: ScreenImportInput) => previewScreenImport(input, deps),
  };
}
