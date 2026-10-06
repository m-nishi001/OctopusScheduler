import { container } from "tsyringe";
import { useBackgroundSyncCore } from "@octopus/composables";
import { SyncService } from "../../control/sync/sync-service";

/** 自動バックグラウンド同期。実体は @octopus/composables の useBackgroundSyncCore。 */
export function useBackgroundSync() {
  return useBackgroundSyncCore(() => container.resolve(SyncService).syncAll());
}
