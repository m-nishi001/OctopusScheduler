/**
 * 書き出し用 ZIP の作成と、取込用 ZIP の展開(fflate)。ZIP の中身は `members.csv` と `photos/<ファイル名>`。
 */
import { unzipSync, zipSync } from "fflate";

export const ROSTER_CSV_NAME = "members.csv";
export const ROSTER_PHOTO_DIR = "photos";

/** 書き出し用 ZIP を作る。写真はすでに圧縮された画像なので、再圧縮しない。 */
export function buildRosterZip(csv: string, photos: ReadonlyMap<string, Uint8Array>): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {
    [ROSTER_CSV_NAME]: [new TextEncoder().encode(csv), { level: 6 }],
  };
  for (const [name, bytes] of photos) entries[`${ROSTER_PHOTO_DIR}/${name}`] = [bytes, { level: 0 }];
  return zipSync(entries);
}

/** 取込用 ZIP を展開する。CSV(最初の `.csv`)と、画像(ほかのファイル、フォルダ名は付けない)を返す。 */
export function readRosterZip(zip: Uint8Array): { csv: Uint8Array | null; images: Map<string, Uint8Array> } {
  const files = unzipSync(zip);
  let csv: Uint8Array | null = null;
  const images = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(files)) {
    if (path.endsWith("/") || path.startsWith("__MACOSX/")) continue;
    const base = path.split("/").pop() ?? path;
    if (base.startsWith(".")) continue;
    if (csv === null && /\.csv$/i.test(base)) csv = bytes;
    else if (/\.(webp|jpe?g|png|gif|bmp|avif|heic)$/i.test(base)) images.set(base, bytes);
  }
  return { csv, images };
}
