/**
 * 予定イベントのレコード(`schedule-events.json`)への操作。副作用の無い純粋な関数だけを置く
 * (読み書き・排他は `schedule-events-use-cases.ts`)。
 *
 * 端末ごとの差分を送るのではなく、サーバーが最新のレコードに「操作」を適用する。
 * 管理画面の編集と、再生端末の状態遷移が同時に来ても、どちらも失われない:
 * - 編集は、イベントの中身だけを入れ替え、処理済み日時・登録日時と実行状態は今あるものを保つ。
 * - 状態遷移は、実行状態(と処理・登録の日時)だけを書き、イベントの中身には触れない。
 * 変えるものが無い操作は、渡したレコードをそのまま返す(呼び出し側は書き込みを省ける)。
 */
import { DomainError } from "@octopus/infrastructures/interfaces";
import { SCHEDULE_EXECUTION_STATUSES } from "./scheduler-api-contract";
import type { ScheduleEventJson, ScheduleEventRecord, ScheduleExecutionStatus } from "./scheduler-api-contract";

/** イベントも実行状態も無い、空のレコード。 */
export const emptyScheduleRecord = (): ScheduleEventRecord => ({ version: 1, events: [], status: {} });

const isRecordObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** 保存してあるテキストをレコードにする。まだ無ければ空。壊れていれば例外(空と取り違えて実データを上書きしないため)。 */
export function parseScheduleRecord(text: string | null): ScheduleEventRecord {
  if (!text) return emptyScheduleRecord();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Stored schedule events are not valid JSON");
  }
  if (!isRecordObject(value) || value.version !== 1 || !Array.isArray(value.events) || !isRecordObject(value.status)) {
    throw new Error("Stored schedule events have an unexpected shape");
  }
  return value as unknown as ScheduleEventRecord;
}

/** クライアントから受け取ったイベントを確かめる。形が違えば DomainError。 */
export function validateScheduleEvent(value: unknown): ScheduleEventJson {
  if (!isRecordObject(value)) throw new DomainError("event is required");
  if (typeof value.id !== "string" || !value.id) throw new DomainError("event.id is required");
  if (typeof value.type !== "string" || !value.type) throw new DomainError("event.type is required");
  for (const key of ["startTime", "endTime", "registeredAt", "updatedAt"] as const) {
    if (!isIso(value[key])) throw new DomainError(`event.${key} must be an ISO date string`);
  }
  if (value.processedAt !== null && !isIso(value.processedAt)) throw new DomainError("event.processedAt must be an ISO date string or null");
  return value as ScheduleEventJson;
}

/** 渡された id の配列を確かめる。形が違えば DomainError。 */
export function validateIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) throw new DomainError("ids must be an array of strings");
  return ids as string[];
}

/** 渡された実行状態を確かめる。知らない値なら DomainError。 */
export function validateStatus(status: unknown): ScheduleExecutionStatus {
  if (!(SCHEDULE_EXECUTION_STATUSES as readonly unknown[]).includes(status)) throw new DomainError(`Invalid status: "${String(status)}"`);
  return status as ScheduleExecutionStatus;
}

/** 受け取ったイベントを入れる。あれば中身を入れ替える(処理済み日時・登録日時は今あるものを保つ)、無ければ追加。 */
function upsert(events: ScheduleEventJson[], incoming: ScheduleEventJson): ScheduleEventJson[] {
  const at = events.findIndex((e) => e.id === incoming.id);
  if (at < 0) return [...events, incoming];
  const current = events[at];
  const merged = { ...incoming, processedAt: current.processedAt, registeredAt: current.registeredAt };
  return events.map((e, i) => (i === at ? merged : e));
}

/** イベントと、その実行状態を消す。 */
function remove(record: ScheduleEventRecord, ids: ReadonlySet<string>): ScheduleEventRecord {
  const events = record.events.filter((e) => !ids.has(e.id));
  const status = Object.fromEntries(Object.entries(record.status).filter(([id]) => !ids.has(id)));
  if (events.length === record.events.length && Object.keys(status).length === Object.keys(record.status).length) return record;
  return { ...record, events, status };
}

/** イベント1件の作成・更新。 */
export function applySaveEvent(record: ScheduleEventRecord, event: ScheduleEventJson): ScheduleEventRecord {
  return { ...record, events: upsert(record.events, validateScheduleEvent(event)) };
}

/** イベントを消す(実行状態も一緒に)。 */
export function applyDeleteEvents(record: ScheduleEventRecord, ids: readonly string[]): ScheduleEventRecord {
  return remove(record, new Set(validateIds(ids)));
}

/** CSV取込の反映: 追加・更新と削除を、1回の操作で。 */
export function applyImportEvents(
  record: ScheduleEventRecord,
  upserts: readonly ScheduleEventJson[],
  deleteIds: readonly string[]
): ScheduleEventRecord {
  if (!Array.isArray(upserts)) throw new DomainError("upserts must be an array");
  const checked = upserts.map(validateScheduleEvent);
  const removed = remove(record, new Set(validateIds(deleteIds)));
  if (checked.length === 0) return removed;
  return { ...removed, events: checked.reduce(upsert, removed.events) };
}

/**
 * 実行状態の遷移。まだあるイベントだけが対象(同時に消されたものは無視)。すでにその状態のものは変えない。
 * 実行中にしたら処理済み日時、完了にしたら登録日時を `nowIso` にする(どちらも更新日時を進める)。
 */
export function applyMarkEvents(
  record: ScheduleEventRecord,
  ids: readonly string[],
  status: ScheduleExecutionStatus,
  nowIso: string
): ScheduleEventRecord {
  const wanted = new Set(validateIds(ids));
  validateStatus(status);
  const targets = new Set(record.events.filter((e) => wanted.has(e.id) && (record.status[e.id] ?? "pending") !== status).map((e) => e.id));
  if (targets.size === 0) return record;
  const events = record.events.map((e) => {
    if (!targets.has(e.id)) return e;
    const stamp = status === "running" ? { processedAt: nowIso } : status === "completed" ? { registeredAt: nowIso } : {};
    return { ...e, ...stamp, updatedAt: nowIso };
  });
  const next = { ...record.status };
  for (const id of targets) {
    if (status === "pending") delete next[id];
    else next[id] = status;
  }
  return { ...record, events, status: next };
}
