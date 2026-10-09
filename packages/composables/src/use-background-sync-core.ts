import { getCurrentInstance, onUnmounted, ref } from "vue";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { usePolling } from "./use-polling";
import { useDebouncedCallback } from "./use-debounce";

/** ローカル変更検知からプッシュまでの待機時間。連続編集を1回にまとめる。 */
const PUSH_DEBOUNCE_MS = 2000;
/** リモート側の変更を拾うための定期同期間隔。 */
const PULL_INTERVAL_MS = 60000;

export type BackgroundSyncStatus = "idle" | "syncing" | "error";

export interface SyncSummary {
  /** リモートからローカルへ取り込んだ件数。1件以上なら "syncPulled" を通知する。 */
  pulled?: number;
  failed: { error: string }[];
}

/**
 * 自動バックグラウンド同期(各アプリ共通)。
 * - ローカル変更(eventBus "syncDirty")を検知したら debounce 後に同期
 * - それとは別に一定間隔でも同期し、他端末からのリモート変更を取り込む
 *   (取り込みがあれば eventBus "syncPulled" で画面へ知らせる)
 * 各アプリは自分の SyncService.syncAll を渡すだけでよい。
 */
export function useBackgroundSyncCore(syncAll: () => Promise<SyncSummary>) {
  const status = ref<BackgroundSyncStatus>("idle");
  const lastError = ref<string | null>(null);

  const runSync = async () => {
    status.value = "syncing";
    try {
      const summary = await syncAll();
      if (summary.failed.length > 0) {
        lastError.value = `${summary.failed.length}件の同期に失敗しました: ${summary.failed[0].error}`;
        status.value = "error";
      } else {
        lastError.value = null;
        status.value = "idle";
      }
      if ((summary.pulled ?? 0) > 0) eventBus.emit("syncPulled");
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e);
      status.value = "error";
    }
  };

  const { trigger: triggerPush, cancel: cancelPush } = useDebouncedCallback(runSync, PUSH_DEBOUNCE_MS);
  const { start, stop } = usePolling(runSync, PULL_INTERVAL_MS, { immediate: true });

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
