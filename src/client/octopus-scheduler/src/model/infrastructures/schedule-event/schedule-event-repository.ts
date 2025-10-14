import { GasFunctionService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { useLocalStorage } from "/root/google_apps_script/octopus-scheduler/src/client/packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../storage-config";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import { ScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable } from "tsyringe";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
  private readonly service;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScheduleEventData")
  );
  private readonly executionStatusStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScheduleEventExecutionStatus")
  );

  constructor() {
    const apiName = "callOctopusSchedulerApi";
    this.service = GasFunctionService.create(apiName)!;
  }

  async getScheduleEvents(): Promise<ScheduleEvent[]> {
    const allEvents = await this.localStorage.getAll<ScheduleEvent>();
    return Array.from(allEvents.values());
  }

  async updateScheduleEvents(events: ScheduleEvent[]): Promise<void> {
    if (!this.service) return;

    await this.service
      .createCall<void>("ScheduleService.updateScheduleEvents", events)
      .withSuccessed(() =>
        console.log("Schedule events updated successfully on remote.")
      )
      .withTimeout(30000)
      .withFailuered((message: string) => {
        throw new Error(
          `Failed to update schedule events on remote: ${message}`
        );
      })
      .invoke();

    for (const event of events) {
      await this.localStorage.save(`${event.id}_${event.settingName}`, event);
    }
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    if (!this.service) return;

    await this.service
      .createCall<void>("ScheduleService.deleteScheduleEvents", { ids })
      .withSuccessed(() =>
        console.log("Schedule events deleted successfully from remote.")
      )
      .withFailuered((message: string) => {
        throw new Error(
          `Failed to delete schedule events from remote: ${message}`
        );
      })
      .invoke();

    const allEvents = await this.localStorage.getAll<ScheduleEvent>();
    const keysToDelete = Array.from(allEvents.entries())
      .filter(([, event]) => ids.includes(event.id))
      .map(([key]) => key);
    await this.localStorage.removeMultiple(keysToDelete);
  }

  async addScheduleEvents(events: ScheduleEvent[]): Promise<string> {
    if (!this.service) return events[0].id;

    return new Promise((resolve, reject) => {
      this.service
        .createCall<string>("ScheduleService.addScheduleEvents", { events })
        .withSuccessed(async (data) => {
          for (const event of events) {
            const addedEvent = { ...event, id: data };
            await this.localStorage.save(
              `${addedEvent.id}_${addedEvent.settingName}`,
              addedEvent
            );
          }
          resolve(data);
        })
        .withTimeout(30000)
        .withFailuered((message: string) => {
          console.error("Failed to add schedule events to remote:", message);
          reject(
            new Error(`Failed to add schedule events to remote: ${message}`)
          );
        })
        .invoke();
    });
  }

  async syncScheduleEvents(): Promise<void> {
    if (!this.service) throw new Error("GAS service not available");

    return new Promise((resolve, reject) => {
      this.service
        .createCall<ScheduleEvent[]>("ScheduleService.getScheduleEvents")
        .withSuccessed(async (data) => {
          await this.localStorage.clear();
          const eventsMap = new Map(
            data.map((e) => [`${e.id}_${e.settingName}`, e])
          );
          await this.localStorage.saveMultiple(eventsMap);
          resolve();
        })
        .withFailuered((message: string) => {
          console.error("Failed to sync schedule events from server:", message);
          reject(
            new Error(`Failed to sync schedule events from server: ${message}`)
          );
        })
        .invoke();
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
