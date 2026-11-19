/**
 * ジャックポット画面設定の一括書き出し・取込を、画面の部品(ui-kit の `TableIoToolbar` / `TableImportDialog`)につなぐ。
 * 判断は {@link ./screen-table} の純粋関数に任せ、ここは「読む → 計画する(プレビュー)→ 画面設定を1回書く」という順序だけを受け持つ。状態は持たない。
 * 表は screens.csv と pages.csv の2つで、書き出しは常に `screens.zip`(素材を含めないときは CSV の2つだけ)。
 * 取込は、ZIP か、CSV を1つ(screens.csv / pages.csv どちらか。見出しで見分ける)。ファイルに出てくる画面だけを、まるごと置き換える(置き換えモードは無い)。
 */
import { saveFile } from "@octopus/client-common/blob/save-file";
import type { FileToSave } from "@octopus/client-common/blob/save-file";
import { hashBlob, mapPool } from "@octopus/sync-engine";
import type { PoolOptions } from "@octopus/sync-engine";
import { MAX_BLOB_BYTES } from "@octopus/infrastructures/interfaces";
import { buildZipOfCsvs, decodeCsvBytes, diffMedia, explainOversized, normalizeHeader, parseCsv, parseTable, readImportFiles, stringifyTable } from "@octopus/table-io";
import type { ImportMode, ParsedTable } from "@octopus/table-io";
import type { JackpotRecord, ScreenSettingRecord } from "../../../server/jackpot-api-contract";
import { countKakuhenPrizes } from "../../model/prize/prize-kakuhen";
import {
  mediaNamesOf,
  PAGE_HEADERS,
  PAGES_CSV_NAME,
  RETIRED_SCREEN_HEADERS,
  rowText,
  SCREEN_CSV_NAME,
  SCREEN_HEADERS,
  screensToTables,
  tablesToScreens,
} from "./screen-table";

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

export const SCREEN_ZIP_NAME = "screens.zip";

/** 画面設定を書き出す。screens.csv と pages.csv を ZIP に入れる。素材つきなら、参照されている素材を1つずつ `media/` に入れる。 */
export async function exportScreens(repo: ScreenTableRepository, options: { includeMedia: boolean }, pool?: PoolOptions): Promise<ScreenExport> {
  const { screens } = await repo.readRecord();
  const tables = screensToTables(screens);
  const csvs: [string, string][] = [
    [SCREEN_CSV_NAME, stringifyTable(SCREEN_HEADERS, tables.screens)],
    [PAGES_CSV_NAME, stringifyTable(PAGE_HEADERS, tables.pages)],
  ];
  const found = options.includeMedia
    ? await mapPool(
        mediaNamesOf(tables),
        async (name) => {
          const blob = await repo.blobOf(name);
          return blob ? ([name, new Uint8Array(await blob.arrayBuffer())] as const) : null;
        },
        pool
      )
    : [];
  const files = found.filter((f) => f !== null);
  return { filename: SCREEN_ZIP_NAME, mime: "application/zip", bytes: buildZipOfCsvs(csvs, files), missingMedia: found.length - files.length };
}

/** 取込に渡す入力。置き換えモードは無いので `mode` は使わない。 */
export interface ScreenImportInput {
  table: File;
  media: readonly File[];
  mode: ImportMode;
}

/** 取り込んだ CSV を、見出しで screens.csv と pages.csv に分けて読む。 */
function readTables(csvs: ReadonlyMap<string, Uint8Array>): { ok: true; screens: Extract<ParsedTable, { ok: true }> | null; pages: Extract<ParsedTable, { ok: true }> | null } | { ok: false; errors: string[] } {
  let screens: Extract<ParsedTable, { ok: true }> | null = null;
  let pages: Extract<ParsedTable, { ok: true }> | null = null;
  const errors: string[] = [];
  for (const [name, bytes] of csvs) {
    let head: string[] = [];
    try {
      head = (parseCsv(decodeCsvBytes(bytes))[0]?.cells ?? []).map(normalizeHeader);
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    // 旧形式(縦長)の見出しには「種類」もあるが、「項目」があれば旧形式なので screens.csv として読んで、使えない見出しのエラーにする
    const isPages = (head.includes("種類") || head.includes("type")) && !head.includes("項目");
    const parsed = parseTable(bytes, isPages ? PAGE_HEADERS : SCREEN_HEADERS, { retired: isPages ? {} : RETIRED_SCREEN_HEADERS });
    if (!parsed.ok) {
      errors.push(...parsed.errors.map((m) => `${name}: ${m}`));
      continue;
    }
    if (isPages) {
      if (pages) errors.push(`${name}: 画面ごとのページの CSV(pages.csv)が2つあります`);
      pages = parsed;
    } else {
      if (screens) errors.push(`${name}: 画面ごとの設定の CSV(screens.csv)が2つあります`);
      screens = parsed;
    }
  }
  if (errors.length === 0 && !screens && !pages) errors.push("CSV が見つかりません");
  return errors.length ? { ok: false, errors } : { ok: true, screens, pages };
}

/** 選んだファイルを読み、計画を立てる(まだ何も書かない)。確定する関数 `apply` を抱えて返る。 */
export async function previewScreenImport(input: ScreenImportInput, deps: ScreenTableIoDeps) {
  const read = await readImportFiles(input.table, input.media, MAX_BLOB_BYTES);
  if (!read.ok) return read;
  const { csvs, files, oversized } = read.value;

  const parsed = readTables(csvs);
  if (!parsed.ok) return parsed;

  const screenRows = parsed.screens?.rows ?? [];
  const pageRows = parsed.pages?.rows ?? [];
  const incomingTables = { screens: screenRows.map((r) => r.cells), pages: parsed.pages ? pageRows.map((r) => r.cells) : null };
  const referenced = mediaNamesOf(incomingTables).filter((name) => files.has(name));

  const [record, hashes] = await Promise.all([
    deps.repo.readRecord(),
    mapPool(referenced, async (name) => [name, await hashBlob(files.get(name)!)] as const, deps.pool),
  ]);
  const incoming = new Map(hashes);
  const diff = diffMedia(Object.fromEntries(Object.entries(record.media).map(([name, m]) => [name, m.hash])), incoming);
  const changedMedia = new Set([...diff.added, ...diff.replaced]);

  const plan = tablesToScreens(incomingTables, {
    available: new Set([...Object.keys(record.media), ...files.keys()]),
    mimeOf: (name) => files.get(name)?.type || record.media[name]?.mime || "",
    current: record.screens,
    kakuhenPrizeCount: countKakuhenPrizes(record.prizes),
  });

  // 画面ごとに、ファイルの内容といまの内容を比べる(行の文字列が同じで、差し替える素材も使わなければ、変更なし)。
  const textOf = (records: readonly ScreenSettingRecord[], settingName: string): { text: string; media: string[] } => {
    const t = screensToTables(records.filter((r) => r.settingName === settingName));
    return { text: JSON.stringify([t.screens.map((r) => rowText(SCREEN_HEADERS, r)), t.pages.map((r) => rowText(PAGE_HEADERS, r))]), media: mediaNamesOf(t) };
  };
  const status = new Map<string, "add" | "update" | "unchanged">();
  for (const next of plan.records) {
    const current = record.screens.find((s) => s.settingName === next.settingName);
    const n = textOf([next], next.settingName);
    const same = !!current && n.text === textOf(record.screens, next.settingName).text && !n.media.some((m) => changedMedia.has(m));
    status.set(next.settingName, !current ? "add" : same ? "unchanged" : "update");
  }

  const rows = explainOversized([
    ...screenRows.map((r, i) => {
      const error = plan.screenErrors[i];
      const label = `${SCREEN_CSV_NAME} ${r.cells.screen ?? ""}`;
      return error
        ? { line: r.line, key: `s${i}`, label, status: "error" as const, message: error }
        : { line: r.line, key: `s${i}`, label, status: status.get(plan.screenTargets[i] ?? "") ?? ("unchanged" as const), message: plan.screenWarnings[i] ?? undefined };
    }),
    ...pageRows.map((r, i) => {
      const error = plan.pageErrors[i];
      const label = `${PAGES_CSV_NAME} ${r.cells.screen ?? ""} ${r.cells.kind ?? ""}`.trim();
      return error
        ? { line: r.line, key: `p${i}`, label, status: "error" as const, message: error }
        : { line: r.line, key: `p${i}`, label, status: status.get(plan.pageTargets[i] ?? "") ?? ("unchanged" as const) };
    }),
  ], oversized, MAX_BLOB_BYTES);
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
