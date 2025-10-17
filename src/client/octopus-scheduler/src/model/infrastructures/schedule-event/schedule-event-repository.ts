import { useLocalStorage } from "/root/google_apps_script/octopus-scheduler/src/client/packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../storage-config";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import { ScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable } from "tsyringe";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScheduleEventData")
  );
  private readonly executionStatusStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScheduleEventExecutionStatus")
  );

  constructor() {
    // No GAS service needed
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
    const keysToDelete = Array.from(allEvents.entries())
      .filter(([, event]) => ids.includes(event.id))
      .map(([key]) => key);
    await this.localStorage.removeMultiple(keysToDelete);
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
    return new Promise((resolve, reject) => {
      (globalThis as any).google.script.run
        .withSuccessHandler((data: any) => {
          this.localStorage.clear();
          const eventsMap = new Map<string, ScheduleEvent>(
            data.map((e: any) => [
              `${e.id}_${e.settingName}`,
              e as ScheduleEvent,
            ])
          );
          this.localStorage.saveMultiple(eventsMap);
          resolve();
        })
        .withFailureHandler((error: any) => {
          console.error("Failed to sync schedule events from server:", error);
          reject(
            new Error(`Failed to sync schedule events from server: ${error}`)
          );
        })
        .getSpreadsheetData("ScheduleEvents");
    });
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
    return Object.fromEntries(allStatuses);
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
