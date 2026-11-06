import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { injectable } from "tsyringe";
import type { AppEventData } from "./app-event-data";
import type { ExecutionStatus } from "./execution-status";

/** 予定イベントと、その実行状態(未実行・実行中・完了)のこの端末への保存(IndexedDB)。 */
@injectable()
export class AppEventRepository {
  private readonly localStorage: LocalStorageService;
  private readonly executionStatusStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService(
      "octopus-scheduler",
      "ScheduleEventData"
    );
    this.executionStatusStorage = new LocalStorageService(
      "octopus-scheduler",
      "ScheduleEventExecutionStatus"
    );
  }

  async getScheduleEvents(): Promise<AppEventData[]> {
    const all = await this.localStorage.getAll<AppEventData>();
    return Array.from(all.values());
  }

  async getEventById(id: string): Promise<AppEventData | null> {
    if (!id) return null;
    try {
      const item = await this.localStorage.get<AppEventData>(id);
      return item ?? null;
    } catch (e) {
      console.error("Failed to get event by id", e);
      return null;
    }
  }

  async updateScheduleEvents(events: AppEventData[]): Promise<void> {
    for (const event of events) {
      await this.localStorage.save(event.id, event);
    }
  }

  /** 予定イベントを消す。実行状態も一緒に消す(同じ id が実行済みのまま残らないように)。 */
  async deleteScheduleEvents(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await Promise.all([this.localStorage.removeMultiple(ids), this.executionStatusStorage.removeMultiple(ids)]);
  }

  /** 取込の反映: 追加・更新するイベントをまとめて書き、消すイベントをまとめて消す(書き込みはそれぞれ1回)。 */
  async applyImport(upserts: readonly AppEventData[], deleteIds: readonly string[]): Promise<void> {
    if (upserts.length > 0) await this.localStorage.saveMultiple(new Map(upserts.map((e) => [e.id, e] as const)));
    await this.deleteScheduleEvents([...deleteIds]);
  }

  async addScheduleEvents(events: AppEventData[]): Promise<string[]> {
    const ids: string[] = [];
    const promises: Promise<void>[] = [];
    for (const ev of events) {
      const id = crypto.randomUUID();
      ids.push(id);
      promises.push(this.localStorage.save(id, { ...ev, id }));
    }
    await Promise.all(promises);
    return ids;
  }

  async getExecutionStatus(eventId: string): Promise<ExecutionStatus | null> {
    const status =
      await this.executionStatusStorage.get<ExecutionStatus>(eventId);
    return status ?? null;
  }

  async updateExecutionStatus(
    eventId: string,
    status: ExecutionStatus
  ): Promise<void> {
    await this.executionStatusStorage.save<ExecutionStatus>(eventId, status);
  }

  async getAllExecutionStatuses(): Promise<{
    [eventId: string]: ExecutionStatus;
  }> {
    const allStatuses =
      await this.executionStatusStorage.getAll<ExecutionStatus>();
    const result: { [eventId: string]: ExecutionStatus } = {};
    for (const [k, v] of allStatuses.entries()) {
      result[k] = v;
    }
    return result;
  }
}
