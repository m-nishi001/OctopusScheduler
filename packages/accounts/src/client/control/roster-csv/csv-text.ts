/**
 * CSV の文字列処理(RFC 4180)。名簿に依存しない純粋関数だけ。
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
