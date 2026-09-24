import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { injectable } from "tsyringe";
import type { AppEventData } from "./app-event-data";
import type { ExecutionStatus } from "./execution-status";

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

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.localStorage.removeMultiple(ids);
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
