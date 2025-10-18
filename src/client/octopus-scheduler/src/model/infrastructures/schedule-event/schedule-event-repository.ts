import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import { ScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable } from "tsyringe";

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

  async getScheduleEvents(): Promise<ScheduleEvent[]> {
    const allEvents = await this.localStorage.getAll<ScheduleEvent>();
    return Array.from(allEvents.values());
  }

  async updateScheduleEvents(events: ScheduleEvent[]): Promise<void> {
    for (const event of events) {
      await this.localStorage.save(`${event.id}_${event.settingName}`, event);
    }
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    const allEvents = await this.localStorage.getAll<ScheduleEvent>();
    const keysToDelete: string[] = [];
    for (const [key, event] of allEvents.entries()) {
      if (ids.includes(event.id)) keysToDelete.push(key);
    }
    if (keysToDelete.length > 0) {
      await this.localStorage.removeMultiple(keysToDelete);
    }
  }

  async addScheduleEvents(events: ScheduleEvent[]): Promise<string> {
    const id = crypto.randomUUID();
    for (const event of events) {
      const addedEvent = { ...event, id };
      await this.localStorage.save(
        `${addedEvent.id}_${addedEvent.settingName}`,
        addedEvent
      );
    }
    return id;
  }

  async syncScheduleEvents(): Promise<void> {
    console.info("syncScheduleEvents: not implemented (GAS calls removed)");
    return Promise.resolve();
  }

  async getExecutionStatus(eventId: string): Promise<string | null> {
    const status = await this.executionStatusStorage.get<string>(eventId);
    return status || null;
  }

  async updateExecutionStatus(eventId: string, status: string): Promise<void> {
    await this.executionStatusStorage.save(eventId, status);
  }

  async getAllExecutionStatuses(): Promise<{ [eventId: string]: string }> {
    const allStatuses = await this.executionStatusStorage.getAll<string>();
    const result: { [eventId: string]: string } = {};
    for (const [k, v] of allStatuses.entries()) {
      result[k] = v;
    }
    return result;
  }

  async markEventAsStarted(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, "running");
  }

  async markEventAsCompleted(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, "completed");
  }

  async markEventAsFailed(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, "completed");
  }
}
