/**
 * 参加者がQRコードから開く回答画面の絶対URLを組み立てる。
 * vue-routerはハッシュモード(createWebHashHistory、apps/app-scheduler側で設定)で
 * 動いているため、デプロイ先のURL(origin+pathname)にハッシュ部分を付け足すだけで、
 * 同じGAS Webアプリのバンドルがこのルートを解決できる。
 */
export function buildParticipantJoinUrl(
  quizId: string,
  query: string,
  location: { origin: string; pathname: string } = window.location
): string {
  return `${location.origin}${location.pathname}#/quiz/${encodeURIComponent(quizId)}/join${query}`;
}

/**
 * サーバーから取得したWebアプリの公開URLを基点に、参加者用URLを組み立てる。
 * 基点URLが取得できなければwindow.location基準にフォールバックする。
 * (GASではwindow.locationが内側のiframe URLになるため、可能な限り公開URLを使う)
 */
export function buildParticipantJoinUrlFromBase(
  quizId: string,
  query: string,
  baseUrl: string | null
): string {
  if (!baseUrl) return buildParticipantJoinUrl(quizId, query);
  const base = baseUrl.split("#")[0];
  return `${base}#/quiz/${encodeURIComponent(quizId)}/join${query}`;
}
