import { getCurrentInstance, onUnmounted, ref } from "vue";
import { container } from "tsyringe";
import { usePolling, useDebouncedCallback } from "@octopus/composables";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { SyncService } from "../../control/sync/sync-service";

/** ローカル変更検知からプッシュまでの待機時間。連続編集を1回にまとめる。 */
const PUSH_DEBOUNCE_MS = 2000;
/** リモート側の変更を拾うための定期同期間隔。 */
const PULL_INTERVAL_MS = 60000;

export type BackgroundSyncStatus = "idle" | "syncing" | "error";

/**
 * 手動の「一括同期」ボタンに代わる自動バックグラウンド同期。
 * - ローカル変更(eventBus "syncDirty")を検知したらdebounce後にすぐ同期
 * - それとは別に一定間隔でも同期し、他端末からのリモート変更を取り込む
 * どちらも同じSyncService.syncAll()を呼ぶだけでよい—LWWにより
 * push/pullの区別は同期エンジン側が担うため。
 */
export function useBackgroundSync() {
  const syncService = container.resolve(SyncService);
  const status = ref<BackgroundSyncStatus>("idle");
  const lastError = ref<string | null>(null);

  const runSync = async () => {
    status.value = "syncing";
    try {
      const summary = await syncService.syncAll();
      if (summary.failed.length > 0) {
        lastError.value = `${summary.failed.length}件の同期に失敗しました: ${summary.failed[0].error}`;
        status.value = "error";
      } else {
        lastError.value = null;
        status.value = "idle";
      }
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e);
      status.value = "error";
    }
  };

  const { trigger: triggerPush, cancel: cancelPush } = useDebouncedCallback(
    runSync,
    PUSH_DEBOUNCE_MS
  );
  const { start, stop } = usePolling(runSync, PULL_INTERVAL_MS, {
    immediate: true,
  });

  const onDirty = () => triggerPush();
  eventBus.on("syncDirty", onDirty);

  const cleanup = () => {
    eventBus.off("syncDirty", onDirty);
    cancelPush();
    stop();
  };

  if (getCurrentInstance()) {
    onUnmounted(cleanup);
  }

  start();

  return { status, lastError, cleanup };
}
