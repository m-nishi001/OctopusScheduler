/**
 * 名簿の CSV 書き出し・取込の判断を集めた純粋関数(Vue にも通信にも依存しない)。
 *
 * - 書式: ヘッダー行 `ID,名前,写真`。写真の列は画像のファイル名(書き出しでは `<id>.<拡張子>`)。
 * - `exportRosterCsv(members, photoFiles)` で書き出した CSV は、そのまま取込に使える(往復で全行「変更なし」)。
 * - `parseRosterCsv(bytes)` → `planRosterImport(current, rows, files)` で、行ごとの結果(追加/更新/変更なし/エラー)と
 *   縮小が必要な画像を決める。削除はしない(CSV に無いメンバーには触れない)。
 */
import type { Member } from "../../../server/accounts-api-contract";
import { decodeCsvBytes, parseCsv, stringifyCsv, type CsvRecord } from "./csv-text";

export const ROSTER_CSV_HEADER = ["ID", "名前", "写真"] as const;
const MAX_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 100;

/** CSV の1行(検証前)。`line` は元のファイルでの行番号(ヘッダーが1)。 */
export interface RosterCsvRow {
  line: number;
  id: string;
  name: string;
  /** 画像のファイル名。空なら写真は変えない。 */
  photo: string;
}

export type RosterCsvParse = { ok: true; rows: RosterCsvRow[] } | { ok: false; errors: string[] };

const COLUMN_ALIASES = {
  id: ["id", "メンバーid", "メンバーID"],
  name: ["name", "名前", "氏名"],
  photo: ["photo", "写真", "画像"],
} as const;

const normalizeHeader = (cell: string): string => cell.normalize("NFKC").trim().toLowerCase();

function findColumn(header: readonly string[], key: keyof typeof COLUMN_ALIASES): number {
  const aliases = COLUMN_ALIASES[key].map(normalizeHeader);
  return header.findIndex((cell) => aliases.includes(normalizeHeader(cell)));
}

/** CSV のバイト列を行にする。ヘッダー(`ID`/`名前` は必須、`写真` は任意)が読めなければ `ok: false`。 */
export function parseRosterCsv(bytes: Uint8Array): RosterCsvParse {
  let table: CsvRecord[];
  try {
    table = parseCsv(decodeCsvBytes(bytes));
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
  if (table.length === 0) return { ok: false, errors: ["CSV にデータがありません"] };
  const [header, ...body] = table;
  const idCol = findColumn(header.cells, "id");
  const nameCol = findColumn(header.cells, "name");
  const photoCol = findColumn(header.cells, "photo");
  const missing = [idCol < 0 && "ID", nameCol < 0 && "名前"].filter(Boolean);
  if (missing.length > 0) {
    return { ok: false, errors: [`ヘッダー行に ${missing.join("・")} の列がありません(1行目は「ID,名前,写真」の形にしてください)`] };
  }
  const rows = body.map(({ line, cells }): RosterCsvRow => ({
    line,
    id: (cells[idCol] ?? "").trim(),
    name: (cells[nameCol] ?? "").trim(),
    photo: photoCol >= 0 ? (cells[photoCol] ?? "").trim() : "",
  }));
  return { ok: true, rows };
}

/** 画像のファイル名の照合用キー: フォルダ部分を除き、大文字小文字と全角半角の差を無視する。 */
export function photoFileKey(name: string): string {
  return (name.split(/[\\/]/).pop() ?? "").normalize("NFKC").toLowerCase();
}

/** 画像の MIME から、書き出すファイルの拡張子。 */
export function photoExtension(mime: string): string {
  switch (mime) {
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

/** ファイル名に使えない文字を `_` にする。 */
const safeFileStem = (id: string): string => Array.from(id, (ch) => (ch < " " || '\\/:*?"<>|'.includes(ch) ? "_" : ch)).join("");

/** 書き出す写真のファイル名(`<id>.<拡張子>`)。 */
export function photoFileName(id: string, mime: string): string {
  return `${safeFileStem(id)}.${photoExtension(mime)}`;
}

/**
 * 名簿を CSV にする(Excel で開けるよう UTF-8 の BOM つき)。`photoFiles` は メンバーの ID → 写真のファイル名。
 * 無い人は写真の列を空にする(取り込むと、いまの写真のまま)。
 */
export function exportRosterCsv(members: readonly Member[], photoFiles: ReadonlyMap<string, string> = new Map()): string {
  const rows = [ROSTER_CSV_HEADER as readonly string[], ...members.map((m) => [m.id, m.name, photoFiles.get(m.id) ?? ""])];
  return "﻿" + stringifyCsv(rows);
}

export type ImportStatus = "add" | "update" | "unchanged" | "error";

/** 取込の計画の1行。 */
export interface PlannedRow {
  line: number;
  /** 空なら新規(ID は保存時に自動採番)。 */
  id: string;
  name: string;
  status: ImportStatus;
  /** エラーの理由。 */
  message?: string;
  /** 縮小して送る必要がある画像の照合キー({@link photoFileKey})。写真を変えない行には無い。 */
  photoKey?: string;
}

export interface RosterImportPlan {
  rows: PlannedRow[];
  counts: Record<ImportStatus, number>;
  /** 縮小して送る画像の照合キー(重複なし)。 */
  photoKeys: string[];
}

/**
 * 取込の計画を立てる。
 * @param files 選ばれた画像の「照合キー → 元ファイルの内容ハッシュ」。元ファイルが名簿の現在の写真と同一
 *   (書き出した写真をそのまま戻した場合)なら、写真は変更なしと判断できる。
 */
export function planRosterImport(
  current: readonly Member[],
  rows: readonly RosterCsvRow[],
  files: ReadonlyMap<string, string>
): RosterImportPlan {
  const byId = new Map(current.map((m) => [m.id, m] as const));
  const seen = new Map<string, number>();
  const planned: PlannedRow[] = rows.map((row) => {
    const base = { line: row.line, id: row.id, name: row.name };
    const error = (message: string): PlannedRow => ({ ...base, status: "error", message });
    if (!row.name) return error("名前が空です");
    if (row.name.length > MAX_NAME_LENGTH) return error(`名前が長すぎます(${MAX_NAME_LENGTH}文字まで)`);
    if (row.id) {
      if (row.id.length > MAX_ID_LENGTH) return error(`ID が長すぎます(${MAX_ID_LENGTH}文字まで)`);
      const first = seen.get(row.id);
      if (first !== undefined) return error(`ID が ${first} 行目と重複しています`);
      seen.set(row.id, row.line);
    }
    const existing = row.id ? byId.get(row.id) : undefined;
    let photoKey: string | undefined;
    if (row.photo) {
      const key = photoFileKey(row.photo);
      const rawHash = files.get(key);
      if (rawHash === undefined) return error(`画像「${row.photo}」が見つかりません`);
      if (!existing || rawHash !== existing.photo) photoKey = key;
    }
    if (!existing) return { ...base, status: "add", photoKey };
    const changed = existing.name !== row.name || photoKey !== undefined;
    return { ...base, status: changed ? "update" : "unchanged", photoKey };
  });
  const counts: Record<ImportStatus, number> = { add: 0, update: 0, unchanged: 0, error: 0 };
  for (const r of planned) counts[r.status]++;
  const photoKeys = [...new Set(planned.filter((r) => r.status !== "error" && r.photoKey).map((r) => r.photoKey!))];
  return { rows: planned, counts, photoKeys };
}

/** 名簿へ一括反映(upsert)する入力。`photo` は省略=いまの写真を保つ。 */
export interface RosterUpsertInput {
  id?: string;
  name: string;
  photo?: string;
}

/**
 * 計画から、名簿へ書く行を作る(追加・更新だけ。変更なし・エラーは含めない)。
 * `photoHashes` は 画像の照合キー → 縮小後の写真のハッシュ。画像の準備に失敗した行は `skipped` に回す。
 */
export function rosterUpserts(
  plan: RosterImportPlan,
  photoHashes: ReadonlyMap<string, string>
): { upserts: RosterUpsertInput[]; skipped: PlannedRow[] } {
  const upserts: RosterUpsertInput[] = [];
  const skipped: PlannedRow[] = [];
  for (const row of plan.rows) {
    if (row.status !== "add" && row.status !== "update") continue;
    const photo = row.photoKey ? photoHashes.get(row.photoKey) : undefined;
    if (row.photoKey && !photo) {
      skipped.push(row);
      continue;
    }
    upserts.push({ id: row.id || undefined, name: row.name, photo });
  }
  return { upserts, skipped };
}
