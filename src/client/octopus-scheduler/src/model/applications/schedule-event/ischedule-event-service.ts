import type { IScheduleEvent } from "../../domains/schedule-event/entity/schedule-event";
import type { EventTypeDto } from "./dtos/event-type-dto";

export interface IScheduleEventService {
    createScheduleEvent(dto: any): Promise<IScheduleEvent | null>;
    getScheduleEventById(scheduleEventId: string): Promise<IScheduleEvent | null>;
    getAllScheduleEvents(): Promise<IScheduleEvent[]>;
    getCurrentScheduleEvent(): Promise<{
        startEvents: IScheduleEvent[],
        endEvents: IScheduleEvent[]
    }>;
    deleteScheduleEvent(scheduleEventId: string): Promise<void>;
    getEventTypeList(): Promise<EventTypeDto[]>;
}
