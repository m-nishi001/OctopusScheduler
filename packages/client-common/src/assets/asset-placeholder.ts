/**
 * HTML コンテンツの中でアセットを指す目印 `{{asset:image|video:<id>}}`。
 * 保存するときは id のまま持ち、表示するときに Blob の URL(`<img>` / `<video>`)に置き換える。
 */
export type AssetPlaceholderType = "image" | "video";

/** 状態(lastIndex)を共有しないよう、使うたびに作る。 */
const pattern = () => /\{\{asset:(image|video):([^}]+)\}\}/g;

/** 目印の文字列を作る。 */
export function assetPlaceholder(type: AssetPlaceholderType, id: string): string {
  return `{{asset:${type}:${id}}}`;
}

/** HTML に含まれる目印の id を、出てくる順に(重複を除いて)返す。 */
export function listAssetPlaceholderIds(html: string): string[] {
  return [...new Set([...html.matchAll(pattern())].map((m) => m[2]))];
}

/**
 * 目印を `<img>` / `<video>` に置き換える。`urlOf` が URL を返さない id の目印はそのまま残す。
 * @param options.autoplay 動画を自動で再生するか(実行画面は true、編集中のプレビューは false)
 */
export function renderAssetPlaceholders(
  html: string,
  urlOf: (id: string) => string | undefined,
  options: { autoplay?: boolean } = {}
): string {
  return html.replace(pattern(), (match, type: AssetPlaceholderType, id: string) => {
    const url = urlOf(id);
    if (!url) return match;
    return type === "image"
      ? `<img src="${url}" alt="asset" />`
      : `<video src="${url}" controls${options.autoplay ? " autoplay" : ""}></video>`;
  });
}

/** 目印の id を付け替える(仮の id → 保存後の id)。`idMap` に無い id はそのまま。 */
export function replaceAssetPlaceholderIds(html: string, idMap: ReadonlyMap<string, string>): string {
  return html.replace(pattern(), (match, type: AssetPlaceholderType, id: string) => {
    const next = idMap.get(id);
    return next ? assetPlaceholder(type, next) : match;
  });
}
