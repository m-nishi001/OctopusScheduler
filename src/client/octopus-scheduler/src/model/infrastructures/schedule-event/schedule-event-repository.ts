import { GasFunctionService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import { ScheduleEventDto } from "../../domains/schedule-event/schedule-event";
import { injectable } from "tsyringe";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
  private readonly service;

  constructor() {
    const apiName = "callOctopusSchedulerApi";
    this.service = GasFunctionService.create(apiName)!;
  }

  async getScheduleEvents(): Promise<ScheduleEventDto[]> {
    return new Promise((resolve) => {
      this.service
        .createCall<ScheduleEventDto[]>("ScheduleService.getScheduleEvents")
        .withSuccessed((data) => resolve(data))
        .withFailuered((message) => {
          console.error(
            "Failed to fetch schedule events from server:",
            message
          );
          resolve([]);
        })
        .invoke();
    });
  }

  async updateScheduleEvents(events: ScheduleEventDto[]): Promise<void> {
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
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
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
  }

  async addScheduleEvents(events: ScheduleEventDto[]): Promise<void> {
    await this.service
      .createCall<void>("ScheduleService.addScheduleEvents", { events })
      .withSuccessed(() =>
        console.log("Schedule events added successfully to remote.")
      )
      .withFailuered((message: string) => {
        throw new Error(`Failed to add schedule events to remote: ${message}`);
      })
      .invoke();
  }
}
