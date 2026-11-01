/** 素材の種類。`file` は、画像・動画・音声のどれでもないもの。 */
export type MediaKind = "image" | "video" | "audio" | "file";

const BY_EXTENSION: Record<string, MediaKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
};

/**
 * 素材の種類を決める。MIME タイプを先に見て、無い(空の)ときだけ、名前の拡張子で決める。
 * サーバーから取った素材は、MIME タイプが空のこともあるため。
 */
export function classifyMedia(mime: string | undefined, name: string | undefined): MediaKind {
  const type = (mime ?? "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  const ext = /\.([A-Za-z0-9]+)$/.exec(name ?? "")?.[1]?.toLowerCase();
  return (ext && BY_EXTENSION[ext]) || "file";
}
