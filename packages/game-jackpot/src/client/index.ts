// jackpot-game 機能モジュールの公開 API。
export { default as jackpotGameRoutes } from "./control/router";
export { Container as JackpotContainer } from "./control/container";
// ホスト端末のデータ準備(セッション開始時にDriveの設定・賞品・アセットを取り込む)に使う。
export { SyncService as JackpotSyncService } from "./control/sync/sync-service";
// メンバーの顔写真（ホスト端末が持つジャックポットのデータ）。エントリー受付の会場画面などで使う。
// 抽選の対象（例: エントリーした人だけ）を、アプリのホストが差し込むためのポート。
export { DrawPoolProviderToken } from "./model/draw/draw-pool";
export type { DrawPoolProvider } from "./model/draw/draw-pool";
export { NoEligibleMembersError } from "./model/errors";
export { setDrawPoolProvider } from "./control/draw/set-draw-pool-provider";
