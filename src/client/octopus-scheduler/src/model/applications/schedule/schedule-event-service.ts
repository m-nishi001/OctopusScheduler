import type { IScheduleEvent } from "../../domains/schedule-event/entity/schedule-event";
import type { IScheduleEventRepository } from "../../domains/schedule-event/repository/schedule-event-repository";
import { ScheduleEventFactory } from "../../domains/schedule-event/schedule-event-factory";
import type { IScheduleEventType } from "../../domains/schedule-event/vo/event-types/event-type";
import { injectable, inject } from "tsyringe";

@injectable()
export class ScheduleEventService {
    private _repo: IScheduleEventRepository;

    constructor(
        @inject("IScheduleEventRepository") scheduleEventRepository: IScheduleEventRepository
    ) {
        this._repo = scheduleEventRepository;
    }

    async createNewScheduleEvent(scheduleEventType: IScheduleEventType, scheduleEventName: string): Promise<IScheduleEvent | null> {
        const newScheduleEvent = scheduleEventType.createScheduleEvent(scheduleEventName);

        if (!newScheduleEvent) throw new Error("Failed to create schedule event.");

        await this._repo.add(newScheduleEvent);

        return ScheduleEventFactory.convertToEntity(newScheduleEvent);
    }

    async getScheduleEventById(scheduleEventId: string): Promise<IScheduleEvent | null> {
        const scheduleEvent = await this._repo.findById(scheduleEventId);
        return scheduleEvent ? ScheduleEventFactory.convertToEntity(scheduleEvent) : null;
    }

    async getAllScheduleEvents(): Promise<IScheduleEvent[]> {
        const scheduleEvents = await this._repo.findAll();
        console.log("Fetched schedule events:", scheduleEvents);
        return scheduleEvents
            .map(event => ScheduleEventFactory.convertToEntity(event))
            .filter(event => event !== null);
    }

    async deleteScheduleEvent(scheduleEventId: string): Promise<void> {
        await this._repo.delete(scheduleEventId);
    }
}