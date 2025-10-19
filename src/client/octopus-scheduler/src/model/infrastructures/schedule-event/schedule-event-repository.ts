import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable } from "tsyringe";
import { ExecutionStatus } from "../../domains/schedule-event/execution-status";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
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

  async getScheduleEvents(): Promise<IScheduleEvent[]> {
    const all = await this.localStorage.getAll<IScheduleEvent>();
    return Array.from(all.values());
  }

  async updateScheduleEvents(events: IScheduleEvent[]): Promise<void> {
    for (const event of events) {
      await this.localStorage.save(event.id, event);
    }
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.localStorage.removeMultiple(ids);
  }

  async addScheduleEvents(events: IScheduleEvent[]): Promise<string> {
    const id = crypto.randomUUID();
    const promises: Promise<void>[] = [];
    for (const ev of events) {
      const newEv = { ...ev, id };
      promises.push(this.localStorage.save(id, newEv));
    }
    await Promise.all(promises);
    return id;
  }

  async syncScheduleEvents(): Promise<void> {
    console.info("syncScheduleEvents: not implemented (GAS calls removed)");
    return Promise.resolve();
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

  async markEventAsStarted(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, ExecutionStatus.Running);
  }

  async markEventAsCompleted(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, ExecutionStatus.Completed);
  }

  async markEventAsFailed(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, ExecutionStatus.Completed);
  }
}
