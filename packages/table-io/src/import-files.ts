/**
 * 取込で選ばれたファイル(CSV または書き出した ZIP と、素材のフォルダ)を読む。画面ごとの取込が同じ入口を使う。
 */
import type { ParsedTable } from "./csv";
import { mediaFileName, REMOVE_MEDIA } from "./media";
import { mimeOfName } from "./mime";
import { readZip } from "./zip";

export interface ImportFiles {
  csv: Uint8Array;
  /** 取り込める素材(ファイル名 → 中身)。フォルダで選んだものは、ZIP の中の同名のものより優先する。 */
  files: Map<string, Blob>;
}

/** 選ばれたファイルを読む。ZIP が壊れている・CSV が無いときはエラー文を返す。 */
export async function readImportFiles(table: File, media: readonly File[]): Promise<{ ok: true; value: ImportFiles } | { ok: false; errors: string[] }> {
  const files = new Map<string, Blob>();
  let csv: Uint8Array;
  if (/\.zip$/i.test(table.name)) {
    let zipped: ReturnType<typeof readZip>;
    try {
      zipped = readZip(new Uint8Array(await table.arrayBuffer()));
    } catch {
      return { ok: false, errors: ["ZIP を開けません"] };
    }
    if (!zipped.csv) return { ok: false, errors: ["ZIP の中に CSV が見つかりません"] };
    csv = zipped.csv;
    for (const [name, bytes] of zipped.media) files.set(name, new Blob([bytes as BlobPart], { type: mimeOfName(name) }));
  } else {
    csv = new Uint8Array(await table.arrayBuffer());
  }
  for (const f of media) files.set(f.name, f.type ? f : f.slice(0, f.size, mimeOfName(f.name)));
  return { ok: true, value: { csv, files } };
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
