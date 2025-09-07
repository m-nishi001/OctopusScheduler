import { GasFunctionService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts";
import type { IScheduleEventRepository } from "../../domains/schedule-event/repository/schedule-event-repository";
import type { IScheduleEvent } from "../../domains/schedule-event/entity/schedule-event";

export class ScheduleEventRepository implements IScheduleEventRepository {
    private readonly service;

    constructor() {
        const apiName = "callOctopusSchedulerApi";
        this.service = GasFunctionService.create(apiName)!;
    }

    public async add(scheduleEvent: IScheduleEvent): Promise<void> {
        await this.service
            .createCall<string>("ScheduleService.add", scheduleEvent.serialize())
            .withSuccessed(() => console.log("Schedule saved successfully to remote."))
            .withFailuered((message: string) => { throw new Error(`Failed to save schedule to remote: ${message}`); })
            .invoke();
    }

    public async findById(scheduleEventId: string): Promise<IScheduleEvent | null> {
        return new Promise((resolve) => {
            this.service.createCall<any>("ScheduleService.findById", scheduleEventId)
                .withSuccessed(data => resolve(data))
                .withFailuered(message => { console.error("Failed to fetch schedule from server:", message); })
                .invoke();
        });
    }

    public async findAll(): Promise<IScheduleEvent[]> {
        return new Promise((resolve) => {
            this.service.createCall<any[]>("ScheduleService.findAll")
                .withSuccessed(data => resolve(data))
                .withFailuered(message => { console.error("Failed to fetch schedules from server:", message); })
                .invoke();
        });
    }

    public async update(scheduleEvent: IScheduleEvent): Promise<void> {
        await this.service
            .createCall<string>("ScheduleService.update", scheduleEvent)
            .withSuccessed(() => console.log("Schedule updated successfully on remote."))
            .withFailuered((message: string) => { throw new Error(`Failed to update schedule on remote: ${message}`); })
            .invoke();
    }

    public async delete(scheduleEventId: string): Promise<void> {
        await this.service
            .createCall<string>("ScheduleService.delete", scheduleEventId)
            .withSuccessed(() => console.log("Schedule deleted successfully from remote."))
            .withFailuered((message: string) => { throw new Error(`Failed to delete schedule from remote: ${message}`); })
            .invoke();
    }
}