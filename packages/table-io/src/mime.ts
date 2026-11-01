/** 素材(画像・音声)のファイル名の拡張子と MIME の対応。ZIP やフォルダから読んだファイルは、種類が分からないことがあるため。 */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
};

/** ファイル名の拡張子から MIME。分からなければ `application/octet-stream`。 */
export function mimeOfName(name: string): string {
  const ext = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

/** MIME から、ファイル名に付ける拡張子(ドット付き)。分からなければ空。 */
export function extensionOfMime(mime: string): string {
  const ext = Object.keys(MIME_BY_EXTENSION).find((e) => MIME_BY_EXTENSION[e] === mime);
  return ext ? `.${ext}` : "";
}
