/**
 * 予定イベントのサーバー側の操作(エンドポイントの本体)。
 * 読み書きと排他だけを持ち、レコードへの操作の適用は `schedule-events-record.ts` の純粋関数に任せる。
 * 書くのは、ロックの中で「最新を読む → 操作を適用 → 変わっていれば保存」だけ(読み取りと、変わらない操作は書かない)。
 */
import { StorageKind, StorageModule, storagePath } from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage, ILock } from "@octopus/infrastructures/interfaces";
import { SCHEDULE_EVENTS_RECORD_FILE } from "./scheduler-api-contract";
import type { ScheduleEventJson, ScheduleEventRecord, ScheduleExecutionStatus } from "./scheduler-api-contract";
import {
  applyDeleteEvents,
  applyImportEvents,
  applyMarkEvents,
  applySaveEvent,
  parseScheduleRecord,
} from "./schedule-events-record";

export interface ScheduleEventsDeps {
  storage: IKeyValueStorage;
  /** 更新を直列化する。未指定なら排他しない(テスト用)。 */
  lock?: ILock;
  /** 現在時刻(テスト用に差し替える)。 */
  now?: () => Date;
}

const LOCK_TIMEOUT_MS = 10_000;
const recordKey = (): string => storagePath(StorageModule.Scheduler, StorageKind.Json, SCHEDULE_EVENTS_RECORD_FILE);

/** 保存してある最新を返す(読むだけ。まだ無ければ空)。 */
export async function getScheduleEvents(deps: ScheduleEventsDeps): Promise<ScheduleEventRecord> {
  return parseScheduleRecord(await deps.storage.getContentAsText(recordKey()));
}

async function mutate(deps: ScheduleEventsDeps, apply: (record: ScheduleEventRecord) => ScheduleEventRecord): Promise<ScheduleEventRecord> {
  const key = recordKey();
  const run = async (): Promise<ScheduleEventRecord> => {
    const current = parseScheduleRecord(await deps.storage.getContentAsText(key));
    const next = apply(current);
    if (next !== current) await deps.storage.putText(key, JSON.stringify(next), "application/json");
    return next;
  };
  return deps.lock ? deps.lock.withLock(`record:${key}`, LOCK_TIMEOUT_MS, run) : run();
}

/** イベント1件の作成・更新。 */
export const saveScheduleEvent = (deps: ScheduleEventsDeps, args: { event: ScheduleEventJson }) =>
  mutate(deps, (r) => applySaveEvent(r, args?.event));

/** イベントを消す。 */
export const deleteScheduleEvents = (deps: ScheduleEventsDeps, args: { ids: string[] }) =>
  mutate(deps, (r) => applyDeleteEvents(r, args?.ids));

/** CSV取込の反映。 */
export const importScheduleEvents = (deps: ScheduleEventsDeps, args: { upserts: ScheduleEventJson[]; deleteIds: string[] }) =>
  mutate(deps, (r) => applyImportEvents(r, args?.upserts ?? [], args?.deleteIds ?? []));

/** 実行状態の遷移。 */
export const markScheduleEvents = (deps: ScheduleEventsDeps, args: { ids: string[]; status: ScheduleExecutionStatus }) =>
  mutate(deps, (r) => applyMarkEvents(r, args?.ids, args?.status, (deps.now?.() ?? new Date()).toISOString()));
