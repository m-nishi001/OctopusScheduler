// jackpot-game 機能モジュールの公開 API。
export { default as jackpotGameRoutes } from "./control/router";
export { Container as JackpotContainer } from "./control/container";
// ホスト端末のデータ準備(セッション開始時にDriveの設定・賞品・アセットを取り込む)に使う。
export { SyncService as JackpotSyncService } from "./control/sync/sync-service";
