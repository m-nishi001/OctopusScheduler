/**
 * 参加者がQRコードから開く回答画面の絶対URLを組み立てる。
 * vue-routerはハッシュモード(createWebHashHistory、apps/app-scheduler側で設定)で
 * 動いているため、デプロイ先のURL(origin+pathname)にハッシュ部分を付け足すだけで、
 * 同じGAS Webアプリのバンドルがこのルートを解決できる。
 */
export function buildParticipantJoinUrl(
  quizId: string,
  location: { origin: string; pathname: string } = window.location
): string {
  return `${location.origin}${location.pathname}#/quiz/${encodeURIComponent(quizId)}/join`;
}
