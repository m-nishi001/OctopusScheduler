import { container } from "tsyringe";
import { useBackgroundSyncCore } from "@octopus/composables";
import { SyncService } from "../../control/sync/sync-service";

/** 同期の対象の種類ごとの表示名(同期の詳細の一覧に出す)。 */
export const SYNC_KIND_LABELS: Record<string, string> = {
  screens: "画面設定",
  prizes: "賞品",
  "member-extras": "名簿",
  asset: "素材",
};

/** 自動バックグラウンド同期。実体は @octopus/composables の useBackgroundSyncCore。 */
export function useBackgroundSync() {
  return useBackgroundSyncCore(() => container.resolve(SyncService).syncAll());
}
