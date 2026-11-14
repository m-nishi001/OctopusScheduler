/**
 * 書き出し用 ZIP の作成と、取込用 ZIP の展開(fflate)。ZIP の中身は `<名前>.csv` と `media/<ファイル名>`。
 * 素材は「同じファイル名 = 同じ素材」として1つだけ入れる。
 */
import { unzipSync, zipSync } from "fflate";

export const MEDIA_DIR = "media";

/** 書き出し用 ZIP を作る(CSV は1つ)。素材はすでに圧縮された画像・音声なので、再圧縮しない。 */
export function buildZip(csvName: string, csv: string, media: Iterable<readonly [string, Uint8Array]>): Uint8Array {
  return buildZipOfCsvs([[csvName, csv]], media);
}

/** 書き出し用 ZIP を作る(CSV は複数。`[ファイル名, 中身]` の並び)。 */
export function buildZipOfCsvs(csvs: Iterable<readonly [string, string]>, media: Iterable<readonly [string, Uint8Array]>): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const [csvName, csv] of csvs) entries[csvName] = [new TextEncoder().encode(csv), { level: 6 }];
  for (const [name, bytes] of media) {
    const path = `${MEDIA_DIR}/${name}`;
    if (!(path in entries)) entries[path] = [bytes, { level: 0 }];
  }
  return zipSync(entries);
}

/** 取込用 ZIP を展開する。CSV(最初の `.csv`。`csvs` はすべての `.csv`: ファイル名 → 中身)と、素材(ほかのファイル。フォルダ名は付けない)を返す。 */
export function readZip(zip: Uint8Array): { csv: Uint8Array | null; csvs: Map<string, Uint8Array>; media: Map<string, Uint8Array> } {
  const files = unzipSync(zip);
  let csv: Uint8Array | null = null;
  const csvs = new Map<string, Uint8Array>();
  const media = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(files)) {
    if (path.endsWith("/") || path.startsWith("__MACOSX/")) continue;
    const base = path.split("/").pop() ?? path;
    if (base.startsWith(".")) continue;
    if (/\.csv$/i.test(base)) {
      csv ??= bytes;
      if (!csvs.has(base)) csvs.set(base, bytes);
    } else if (!media.has(base)) media.set(base, bytes);
  }
  return { csv, csvs, media };
}
