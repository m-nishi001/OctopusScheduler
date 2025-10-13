import { GasFunctionService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { useLocalStorage } from "/root/google_apps_script/octopus-scheduler/src/client/packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../storage-config";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEventEntity } from "../../domains/schedule-event/i-schedule-event-entity";
import { injectable } from "tsyringe";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
  private readonly service;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScheduleEventData")
  );

  constructor() {
    const apiName = "callOctopusSchedulerApi";
    this.service = GasFunctionService.create(apiName)!;
  }

  async getScheduleEvents(): Promise<IScheduleEventEntity[]> {
    const allEvents = await this.localStorage.getAll<IScheduleEventEntity>();
    return Array.from(allEvents.values());
  }

  async updateScheduleEvents(events: IScheduleEventEntity[]): Promise<void> {
    if (!this.service) return;

    await this.service
      .createCall<void>("ScheduleService.updateScheduleEvents", events)
      .withSuccessed(() =>
        console.log("Schedule events updated successfully on remote.")
      )
      .withFailuered((message: string) => {
        throw new Error(
          `Failed to update schedule events on remote: ${message}`
        );
      })
      .invoke();

    for (const event of events) {
      await this.localStorage.save(event.id, event);
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

    await this.localStorage.removeMultiple(ids);
  }

  async addScheduleEvents(events: IScheduleEventEntity[]): Promise<string[]> {
    if (!this.service) return events.map((e) => e.id);

    return new Promise((resolve, reject) => {
      this.service
        .createCall<string[]>("ScheduleService.addScheduleEvents", { events })
        .withSuccessed(async (data) => {
          // 渡したeventsと返されたidsを組み合わせてローカルストレージに保存
          const addedEvents = events.map((event, index) => ({
            ...event,
            id: data[index],
          }));

          for (const addedEvent of addedEvents) {
            await this.localStorage.save(addedEvent.id, addedEvent);
          }

          resolve(data);
        })
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
        .createCall<IScheduleEventEntity[]>("ScheduleService.getScheduleEvents")
        .withSuccessed(async (data) => {
          for (const event of data) {
            await this.localStorage.save(event.id, event);
          }
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
}
