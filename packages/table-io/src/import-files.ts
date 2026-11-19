/**
 * 取込で選ばれたファイル(CSV または書き出した ZIP と、素材のフォルダ)を読む。画面ごとの取込が同じ入口を使う。
 */
import type { ParsedTable } from "./csv";
import { mediaFileName, REMOVE_MEDIA } from "./media";
import { mimeOfName } from "./mime";
import { readZip } from "./zip";

export interface ImportFiles {
  csv: Uint8Array;
  /** CSV のすべて(ファイル名 → 中身)。ZIP に複数の CSV が入っているとき(画面設定の screens.csv と pages.csv)に使う。CSV を1つ選んだときは、そのファイルだけ。 */
  csvs: Map<string, Uint8Array>;
  /** 取り込める素材(ファイル名 → 中身)。フォルダで選んだものは、ZIP の中の同名のものより優先する。 */
  files: Map<string, Blob>;
  /** 1つのファイルの上限(`maxBytes`)を超えていて、取り込めない素材(ファイル名 → バイト数)。`files` には入れない。 */
  oversized: Map<string, number>;
}

/** 選ばれたファイルを読む。ZIP が壊れている・CSV が無いときはエラー文を返す。 */
export async function readImportFiles(table: File, media: readonly File[], maxBytes: number = Infinity): Promise<{ ok: true; value: ImportFiles } | { ok: false; errors: string[] }> {
  const files = new Map<string, Blob>();
  let csv: Uint8Array;
  const csvs = new Map<string, Uint8Array>();
  if (/\.zip$/i.test(table.name)) {
    let zipped: ReturnType<typeof readZip>;
    try {
      zipped = readZip(new Uint8Array(await table.arrayBuffer()));
    } catch {
      return { ok: false, errors: ["ZIP を開けません"] };
    }
    if (!zipped.csv) return { ok: false, errors: ["ZIP の中に CSV が見つかりません"] };
    csv = zipped.csv;
    for (const [name, bytes] of zipped.csvs) csvs.set(name, bytes);
    for (const [name, bytes] of zipped.media) files.set(name, new Blob([bytes as BlobPart], { type: mimeOfName(name) }));
  } else {
    csv = new Uint8Array(await table.arrayBuffer());
    csvs.set(table.name, csv);
  }
  for (const f of media) files.set(f.name, f.type ? f : f.slice(0, f.size, mimeOfName(f.name)));
  // 上限を超える素材は、送っても必ず断られる。取り込める素材には入れず、どの行が使おうとしたかを後で説明する
  const oversized = new Map<string, number>();
  for (const [name, blob] of files) {
    if (blob.size > maxBytes) {
      oversized.set(name, blob.size);
      files.delete(name);
    }
  }
  return { ok: true, value: { csv, csvs, files, oversized } };
}

/** CSV の素材の列が指していて、選ばれたファイルにもある素材の名前(重複なし)。 */
export function referencedMedia(parsed: Extract<ParsedTable, { ok: true }>, files: ReadonlyMap<string, unknown>): string[] {
  const keys = parsed.headers.filter((h) => h.media).map((h) => h.key);
  const names = new Set<string>();
  for (const { cells } of parsed.rows) {
    for (const key of keys) {
      const cell = cells[key];
      if (cell && cell !== REMOVE_MEDIA && files.has(mediaFileName(cell))) names.add(mediaFileName(cell));
    }
  }
  return [...names];
}

/**
 * 取り込めない大きさの素材を使おうとした行のエラーを、「見つかりません」ではなく、ファイル名と上限を示す文に置き換える
 * (素材を探したが無かった、と読み違えないため)。行のメッセージに素材のファイル名が「」で入っているものが対象。
 */
export function explainOversized<R extends { status: string; message?: string }>(
  rows: readonly R[],
  oversized: ReadonlyMap<string, number>,
  maxBytes: number
): R[] {
  if (oversized.size === 0) return [...rows];
  return rows.map((row) => {
    if (row.status !== "error" || !row.message) return row;
    for (const [name, size] of oversized) {
      if (row.message.includes(`「${name}」`)) {
        return { ...row, message: oversizedMessage(name, size, maxBytes) };
      }
    }
    return row;
  });
}

const MB = 1024 * 1024;
const oversizedMessage = (name: string, size: number, maxBytes: number) => `素材「${name}」が上限(${(maxBytes / MB).toFixed(1)}MB)を超えています(${(size / MB).toFixed(1)}MB)。圧縮するか分けてください`;

/**
 * 取り込めない大きさの素材を CSV の列(`keys`)が指している行を、エラーにする(すでに同名の素材があって、行自体は問題なく通ってしまう場合も、
 * 新しい中身が取り込まれないまま「変更なし」と出さないため)。件数(counts)も数え直して返す。
 */
export function flagOversizedRows<R extends { line: number | null; status: string; message?: string }>(
  rows: readonly R[],
  parsedRows: readonly { line: number; cells: Record<string, string | undefined> }[],
  keys: readonly string[],
  oversized: ReadonlyMap<string, number>,
  maxBytes: number
): { rows: R[]; counts: Record<"add" | "update" | "unchanged" | "delete" | "error", number> } {
  const namesByLine = new Map<number, string[]>();
  for (const { line, cells } of parsedRows) {
    namesByLine.set(
      line,
      keys.map((k) => mediaFileName(cells[k] ?? "")).filter((n) => oversized.has(n))
    );
  }
  const out = rows.map((row) => {
    const hit = row.line === null ? undefined : namesByLine.get(row.line)?.[0];
    return hit && row.status !== "error" ? { ...row, status: "error", message: oversizedMessage(hit, oversized.get(hit)!, maxBytes) } : row;
  });
  const counts = { add: 0, update: 0, unchanged: 0, delete: 0, error: 0 };
  for (const r of out) counts[r.status as keyof typeof counts]++;
  return { rows: out, counts };
}
