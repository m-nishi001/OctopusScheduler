/**
 * エントリー者が取り消された合図(同じ端末の中で、イベントのホスト側から抽選画面へ)。
 * 先読みで確定した抽選がサーバーで削除されていることがあるので、抽選画面は保存先を読み直して先読みを作り直す。
 */
export const ENTRANTS_CHANGED_EVENT = "octopus:entrants-changed";

/** エントリーの取り消しを、同じ端末の抽選画面に知らせる(ホスト側のイベント処理が、取り消しの成功後に呼ぶ)。 */
export function notifyEntrantsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ENTRANTS_CHANGED_EVENT));
}
