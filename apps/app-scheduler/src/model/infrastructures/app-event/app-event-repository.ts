import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import type { IAppEventRepository } from "../../domains/app-event/app-event-repository";
import type { IAppEvent } from "../../domains/app-event/app-event";
import { injectable } from "tsyringe";
import type { ExecutionStatus } from "../../domains/app-event/execution-status";

@injectable()
export class AppEventRepository implements IAppEventRepository {
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

  async getScheduleEvents(): Promise<IAppEvent[]> {
    const all = await this.localStorage.getAll<IAppEvent>();
    return Array.from(all.values());
  }

  async getEventById(id: string): Promise<IAppEvent | null> {
    if (!id) return null;
    try {
      const item = await this.localStorage.get<IAppEvent>(id);
      return (item as IAppEvent) || null;
    } catch (e) {
      console.error("Failed to get event by id", e);
      return null;
    }
  }

  async updateScheduleEvents(events: IAppEvent[]): Promise<void> {
    for (const event of events) {
      await this.localStorage.save(event.id, event);
    }
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.localStorage.removeMultiple(ids);
  }

  async addScheduleEvents(events: IAppEvent[]): Promise<string> {
    const id = crypto.randomUUID();
    const promises: Promise<void>[] = [];
    for (const ev of events) {
      const newEv = { ...ev, id };
      promises.push(this.localStorage.save(id, newEv));
    }
    await Promise.all(promises);
    return id;
  }


  async getExecutionStatus(eventId: string): Promise<ExecutionStatus | null> {
    const status =
      await this.executionStatusStorage.get<ExecutionStatus>(eventId);
    return (status as ExecutionStatus) || null;
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
      result[k] = v as ExecutionStatus;
    }
    return result;
  }
}
