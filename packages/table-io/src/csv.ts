/**
 * CSV の文字列処理(RFC 4180)と、見出し付きの表(`Header` 定義に沿った読み書き)。個別の画面に依存しない純粋関数だけ。
 * - 読み込み: BOM・CRLF/LF/CR・引用符・セル内の改行・`""` のエスケープ。
 * - 文字コード: UTF-8 として厳密に読めなければ Shift_JIS として読む(Excel の「CSV」保存に備える)。
 */

/** バイト列を文字列にする。UTF-8 として厳密に読めなければ Shift_JIS。BOM は取り除く。 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  let text: string;
  try {
    // ignoreBOM を既定(false)のままにして、BOM は読み込み時に取り除く。
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("shift_jis").decode(bytes);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** CSV の1レコード。`line` はそのレコードが始まるファイル上の行番号(1始まり)。 */
export interface CsvRecord {
  line: number;
  cells: string[];
}

/** 引用符を解いたレコードの配列にする。全セルが空の行(空行)は捨てる。引用符が閉じていなければ例外。 */
export function parseCsv(text: string): CsvRecord[] {
  const rows: CsvRecord[] = [];
  let line = 1;
  let rowLine = 1;
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let cellStarted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
    cellStarted = false;
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== "")) rows.push({ line: rowLine, cells: row });
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) line++;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && !cellStarted) {
      quoted = true;
      cellStarted = true;
    } else if (ch === ",") {
      endCell();
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;
        line++;
      }
      endRow();
      rowLine = line;
    } else {
      cell += ch;
      cellStarted = true;
    }
  }
  if (quoted) throw new Error("引用符(\")が閉じていません");
  if (cellStarted || cell !== "" || row.length > 0) endRow();
  return rows;
}

/** セルを CSV の書式にする(カンマ・引用符・改行を含むときだけ引用符で囲む)。 */
function quoteCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 二次元配列を CSV 文字列にする(改行は CRLF、末尾にも改行)。 */
export function stringifyCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(quoteCell).join(",") + "\r\n").join("");
}

/** 表の列の定義。`key` が {@link Row} のキー、`label` が CSV の見出し(日本語)。 */
export interface Header {
  key: string;
  label: string;
  /** 見出しの別名(英語名など)。照合のとき、`label` と同じように扱う。 */
  aliases?: readonly string[];
  /** 真なら、この列が無いファイルは読めない。 */
  required?: boolean;
  /** 真なら、この列のセルは素材(画像・音声)のファイル名。 */
  media?: boolean;
}

/** 表の1行: 列の `key` → セルの文字列。 */
export type Row = Record<string, string>;

/** 読み込んだ1行。`line` は元のファイルでの行番号(ヘッダーが1)。`cells` の文字列は前後の空白を除いてある。 */
export interface ParsedRow {
  line: number;
  cells: Row;
}

/** 読んだ表。`headers` は実際に使った列の定義(列が可変の表では、ファイルの見出しから決めたもの)。 */
export type ParsedTable = { ok: true; rows: ParsedRow[]; headers: readonly Header[] } | { ok: false; errors: string[] };

/** 列の定義。列の数がファイルによって変わる表では、ファイルの見出し(`normalizeHeader` 済み)から決める関数を渡す。 */
export type HeadersSource = readonly Header[] | ((names: readonly string[]) => readonly Header[]);

/** 見出しの照合用の形: NFKC で正規化し、前後の空白を除いて小文字にする。 */
export const normalizeHeader = (cell: string): string => cell.normalize("NFKC").trim().toLowerCase();

/** CSV のバイト列を行にする。必須の列が無ければ `ok: false`。無い任意の列のセルは空文字。 */
export function parseTable(bytes: Uint8Array, source: HeadersSource): ParsedTable {
  let table: CsvRecord[];
  try {
    table = parseCsv(decodeCsvBytes(bytes));
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
  if (table.length === 0) return { ok: false, errors: ["CSV にデータがありません"] };
  const [head, ...body] = table;
  const names = head.cells.map(normalizeHeader);
  const headers = typeof source === "function" ? source(names) : source;
  const columns = headers.map((h) => {
    const wanted = [h.label, ...(h.aliases ?? [])].map(normalizeHeader);
    return { header: h, index: names.findIndex((n) => wanted.includes(n)) };
  });
  const missing = columns.filter((c) => c.header.required && c.index < 0).map((c) => c.header.label);
  if (missing.length > 0) {
    const shape = headers.filter((h) => h.required).map((h) => h.label).join(",");
    return { ok: false, errors: [`ヘッダー行に ${missing.join("・")} の列がありません(1行目は「${shape}」を含む形にしてください)`] };
  }
  const rows = body.map(({ line, cells }): ParsedRow => {
    const row: Row = {};
    for (const { header, index } of columns) row[header.key] = index < 0 ? "" : (cells[index] ?? "").trim();
    return { line, cells: row };
  });
  return { ok: true, rows, headers };
}

/** 表を CSV 文字列にする(Excel で開けるよう UTF-8 の BOM つき、改行は CRLF)。 */
export function stringifyTable(headers: readonly Header[], rows: readonly Row[]): string {
  return "\uFEFF" + stringifyCsv([headers.map((h) => h.label), ...rows.map((r) => headers.map((h) => r[h.key] ?? ""))]);
}
