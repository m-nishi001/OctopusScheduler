/** 書き出したファイル。 */
export interface FileToSave {
  filename: string;
  mime: string;
  bytes: Uint8Array;
}

/** ブラウザのダウンロードとして保存する。 */
export function saveFile({ filename, mime, bytes }: FileToSave): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
