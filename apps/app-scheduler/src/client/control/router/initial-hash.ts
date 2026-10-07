/**
 * GASのgoogle.script.url.getLocationが返すハッシュ("/quiz/x/join"、先頭の#有無は問わない)を
 * vue-routerのパスに変換する。ハッシュが空なら null。
 */
export function hashToPath(hash: string | null | undefined): string | null {
  const body = (hash ?? "").replace(/^#?\/?/, "");
  return body ? `/${body}` : null;
}
