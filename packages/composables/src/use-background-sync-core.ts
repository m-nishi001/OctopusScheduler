import { getCurrentInstance, onUnmounted, ref } from "vue";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { usePolling } from "./use-polling";
import { useDebouncedCallback } from "./use-debounce";

/** ローカル変更検知からプッシュまでの待機時間。連続編集を1回にまとめる。 */
const PUSH_DEBOUNCE_MS = 2000;
/** リモート側の変更を拾うための定期同期間隔。 */
const PULL_INTERVAL_MS = 60000;

export type BackgroundSyncStatus = "idle" | "syncing" | "error";

/** 対象1件の同期結果(@octopus/sync-engine の SyncTargetResult と同じ形)。 */
export interface SyncResultEntry {
  id: string;
  kind: string;
  result: "pushed" | "pulled" | "skipped" | "failed";
  /** 失敗したときに決まっていた向き(向きが決まる前の失敗は無し)。 */
  action?: "push" | "pull" | "skip";
  error?: string;
}

/** 同期の結果。対象ごとの一覧だけを持つ。 */
export interface SyncSummary {
  results: SyncResultEntry[];
}

/** 同期のログ1件の種類。送信の成功と skip は記録しない。 */
export type SyncLogEvent = "pushFailed" | "pullFailed" | "syncFailed" | "pulledFromOther";

export interface SyncLogEntry {
  /** 記録した時刻(ミリ秒)。 */
  at: number;
  /** 同期の対象の種類(例: "screens")。同期の呼び出し自体の失敗は "sync"。 */
  kind: string;
  /** 対象のid(種類ごとに1件のものは kind と同じ。素材はその素材のid)。 */
  id: string;
  event: SyncLogEvent;
  /** 失敗の理由(例外のメッセージ全文)。 */
  error?: string;
}

/** 同期ログに残す最大件数(メモリ上だけ。保存はしない)。 */
const MAX_LOG_ENTRIES = 50;

const failureEvent = (r: SyncResultEntry): SyncLogEvent =>
  r.action === "push" ? "pushFailed" : r.action === "pull" ? "pullFailed" : "syncFailed";

/**
 * 自動バックグラウンド同期(各アプリ共通)。
 * - ローカル変更(eventBus "syncDirty")を検知したら debounce 後に同期
 * - それとは別に一定間隔でも同期し、他端末からのリモート変更を取り込む
 *   (取り込みがあれば eventBus "syncPulled" で画面へ知らせる)
 * - 失敗と、他の端末の変更を反映した記録を、時刻付きで直近50件まで持つ(log。送信の成功と skip は記録しない)
 * 各アプリは自分の SyncService.syncAll を渡すだけでよい。
 */
export function useBackgroundSyncCore(syncAll: () => Promise<SyncSummary>) {
  const status = ref<BackgroundSyncStatus>("idle");
  const lastError = ref<string | null>(null);
  /** 新しいものが先頭。 */
  const log = ref<SyncLogEntry[]>([]);

  const record = (entries: Omit<SyncLogEntry, "at">[]) => {
    if (entries.length === 0) return;
    const at = Date.now();
    const added = entries.map((e) => ({ ...e, at })).reverse();
    // 同じ失敗が毎回の同期で続いても、一覧が同じ行で埋まらないよう、同じ内容の古い失敗の行は時刻を新しくして1行にまとめる
    const same = (x: SyncLogEntry, y: SyncLogEntry) => x.event !== "pulledFromOther" && x.kind === y.kind && x.id === y.id && x.event === y.event && x.error === y.error;
    const kept = log.value.filter((old) => !added.some((n) => same(n, old)));
    log.value = [...added, ...kept].slice(0, MAX_LOG_ENTRIES);
  };

  const syncOnce = async () => {
    status.value = "syncing";
    try {
      const { results } = await syncAll();
      const failed = results.filter((r) => r.result === "failed");
      if (failed.length > 0) {
        lastError.value = `${failed.length}件の同期に失敗しました: ${failed[0].error}`;
        status.value = "error";
      } else {
        lastError.value = null;
        status.value = "idle";
      }
      const entries: Omit<SyncLogEntry, "at">[] = [];
      for (const r of results) {
        if (r.result === "failed") entries.push({ kind: r.kind, id: r.id, event: failureEvent(r), error: r.error });
        else if (r.result === "pulled") entries.push({ kind: r.kind, id: r.id, event: "pulledFromOther" });
      }
      record(entries);
      if (results.some((r) => r.result === "pulled")) eventBus.emit("syncPulled");
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e);
      status.value = "error";
      record([{ kind: "sync", id: "sync", event: "syncFailed", error: lastError.value }]);
    }
  };

  let running = false;
  let requestedWhileRunning = false;

  /**
   * 同期を実行する。同期中に呼ばれたら重ねて走らせず、いまの同期が終わったあとにもう1回だけ流す
   * (同期の途中で起きたローカル変更を取りこぼさないため。重なると同じ素材を同時に保存しようとして競合する)。
   */
  const runSync = async () => {
    if (running) {
      requestedWhileRunning = true;
      return;
    }
    running = true;
    try {
      do {
        requestedWhileRunning = false;
        await syncOnce();
      } while (requestedWhileRunning);
    } finally {
      running = false;
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

  return { status, lastError, log, cleanup };
}
