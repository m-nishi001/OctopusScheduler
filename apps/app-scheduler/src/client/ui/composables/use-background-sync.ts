import { ref } from "vue";
import { container } from "tsyringe";
import { useBackgroundSyncCore } from "@octopus/composables";
import type { BackgroundSyncStatus, SyncLogEntry } from "@octopus/composables";
import { SyncService } from "../../control/sync/sync-service";

/** 同期の対象の種類ごとの表示名(同期の詳細の一覧に出す)。 */
export const SYNC_KIND_LABELS: Record<string, string> = {
  asset: "素材",
};

let shared: ReturnType<typeof useBackgroundSyncCore> | null = null;

/**
 * アプリ全体の自動バックグラウンド同期を始める(すでに動いていれば何もしない)。実体は @octopus/composables の useBackgroundSyncCore。
 * 設定画面を離れても、アップロードが続くように、画面(コンポーネント)の中からは呼ばない。
 * 画面の中で呼ぶと、useBackgroundSyncCore の定期実行などが、その画面が外れたときに止まってしまうため。
 * `App.vue` が、管理者としてログインしている間に呼ぶ。
 */
export function startBackgroundSync(): void {
  shared ??= useBackgroundSyncCore(() => container.resolve(SyncService).syncAll());
}

/** アプリ全体の同期を止める(ログアウトしたとき)。 */
export function stopBackgroundSync(): void {
  shared?.cleanup();
  shared = null;
}

type SyncState = Pick<ReturnType<typeof useBackgroundSyncCore>, "status" | "lastError" | "log">;

const IDLE: SyncState = { status: ref<BackgroundSyncStatus>("idle"), lastError: ref<string | null>(null), log: ref<SyncLogEntry[]>([]) };

/** 動いている同期の状態(各画面が読む)。始まっていなければ(ログインの前など)、画面の中で始めず、状態は空のまま。 */
export function useBackgroundSync(): SyncState {
  return shared ?? IDLE;
}
