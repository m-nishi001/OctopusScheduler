import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { toDateOrNow, toDateOrNull } from "@octopus/client-common/date-utils/date-utils";
import { inject, injectable } from "tsyringe";
import { IOctopusSchedulerApiToken } from "../../../server/scheduler-api-contract";
import type { OctopusSchedulerApi, ScheduleEventJson, ScheduleEventRecord } from "../../../server/scheduler-api-contract";
import type { AppEventData } from "./app-event-data";
import type { ExecutionStatus } from "./execution-status";

/** サーバーのレコードを最後に取得した内容を置く、この端末の読み取り用キャッシュ(ストアも、キーも1つだけ)。 */
const CACHE_DB = "octopus-scheduler";
const CACHE_STORE = "ScheduleEventsRecord";
const CACHE_KEY = "record";

/** サーバーの1件(日時は ISO 文字列)を、保存形の `AppEventData`(日時は Date)にする。種類・中身の検証は `reviveAppEvent`。 */
export function eventFromJson(json: ScheduleEventJson): AppEventData {
  return {
    ...json,
    startTime: toDateOrNow(json.startTime),
    endTime: toDateOrNow(json.endTime),
    processedAt: toDateOrNull(json.processedAt),
    registeredAt: toDateOrNow(json.registeredAt),
    updatedAt: toDateOrNow(json.updatedAt),
  } as unknown as AppEventData;
}

/** `AppEventData` を、サーバーに送る形(日時は ISO 文字列)にする。 */
export function eventToJson(event: AppEventData): ScheduleEventJson {
  return {
    ...event,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    processedAt: event.processedAt ? event.processedAt.toISOString() : null,
    registeredAt: event.registeredAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

/**
 * 予定イベントと、その実行状態(未実行・実行中・完了)。正となるのはサーバーのレコード1件で、全端末で共有する。
 * この端末の IndexedDB は、最後に取得したレコードを置く読み取り用のキャッシュだけ(取得に失敗したとき、
 * ネットワークが切れても再生を続けられるように使う)。キャッシュへの書き込みは、取得・操作の結果を写すだけで、サーバーには書かない。
 * 書き込み(編集・取込・状態遷移)はサーバーの操作として1回ずつ送り、返ってきた最新をキャッシュに写す。
 */
@injectable()
export class AppEventRepository {
  private readonly cache = new LocalStorageService(CACHE_DB, CACHE_STORE);

  constructor(@inject(IOctopusSchedulerApiToken) private readonly api: OctopusSchedulerApi) {}

  /** サーバーの最新を取って、キャッシュに写す。取れなければキャッシュ(それも無ければ例外)。 */
  private async load(): Promise<ScheduleEventRecord> {
    try {
      return await this.remember(await this.api.getScheduleEvents());
    } catch (e) {
      const cached = await this.readCache();
      if (!cached) throw e;
      console.warn("Failed to fetch schedule events; using the cached copy", e);
      return cached;
    }
  }

  private async readCache(): Promise<ScheduleEventRecord | null> {
    try {
      return (await this.cache.get<ScheduleEventRecord>(CACHE_KEY)) ?? null;
    } catch {
      return null;
    }
  }

  private async remember(record: ScheduleEventRecord): Promise<ScheduleEventRecord> {
    try {
      await this.cache.save(CACHE_KEY, record);
    } catch (e) {
      console.warn("Failed to cache schedule events", e);
    }
    return record;
  }

  /** サーバーの最新をキャッシュに写すだけ(再生端末の定期取得。サーバーには書かない)。失敗は握りつぶす(次の周期で取り直す)。 */
  async refresh(): Promise<void> {
    try {
      await this.remember(await this.api.getScheduleEvents());
    } catch (e) {
      console.warn("Failed to refresh schedule events", e);
    }
  }

  async getScheduleEvents(): Promise<AppEventData[]> {
    return (await this.load()).events.map(eventFromJson);
  }

  /** イベントと実行状態を、同じ取得(サーバーのレコード1件)から返す。別々に取って食い違わないように。 */
  async getSnapshot(): Promise<{ events: AppEventData[]; status: { [eventId: string]: ExecutionStatus } }> {
    const record = await this.load();
    return { events: record.events.map(eventFromJson), status: { ...record.status } };
  }

  async getEventById(id: string): Promise<AppEventData | null> {
    if (!id) return null;
    const found = (await this.load()).events.find((e) => e.id === id);
    return found ? eventFromJson(found) : null;
  }

  /** 予定イベント1件の作成・更新(サーバーが、処理済み日時・登録日時はすでにあるものを保つ)。 */
  async saveScheduleEvent(event: AppEventData): Promise<void> {
    await this.remember(await this.api.saveScheduleEvent({ event: eventToJson(event) }));
  }

  /** 予定イベントを消す。実行状態も一緒に消える。 */
  async deleteScheduleEvents(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.remember(await this.api.deleteScheduleEvents({ ids }));
  }

  /** 取込の反映: 追加・更新するイベントと消すイベントを、サーバーへ1回の操作で送る。 */
  async applyImport(upserts: readonly AppEventData[], deleteIds: readonly string[]): Promise<void> {
    if (upserts.length === 0 && deleteIds.length === 0) return;
    await this.remember(await this.api.importScheduleEvents({ upserts: upserts.map(eventToJson), deleteIds: [...deleteIds] }));
  }

  /** 実行状態の遷移(再生端末)。イベントの中身は編集と別の操作で、互いを上書きしない。 */
  async markScheduleEvents(ids: string[], status: ExecutionStatus): Promise<void> {
    if (ids.length === 0) return;
    await this.remember(await this.api.markScheduleEvents({ ids, status }));
  }

  async getExecutionStatus(eventId: string): Promise<ExecutionStatus | null> {
    return (await this.load()).status[eventId] ?? null;
  }

  async getAllExecutionStatuses(): Promise<{ [eventId: string]: ExecutionStatus }> {
    return { ...(await this.load()).status };
  }
}
