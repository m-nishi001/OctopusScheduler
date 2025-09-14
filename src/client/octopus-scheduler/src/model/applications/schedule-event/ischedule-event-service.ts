import type { IScheduleEvent } from "../../domains/schedule-event/entity/schedule-event";

export interface IScheduleEventService {
    createScheduleEvent(dto: any): Promise<IScheduleEvent | null>;
    getScheduleEventById(scheduleEventId: string): Promise<IScheduleEvent | null>;
    getAllScheduleEvents(): Promise<IScheduleEvent[]>;
    getCurrentScheduleEvent(): Promise<{
        startEvents: IScheduleEvent[],
        endEvents: IScheduleEvent[]
    }>;
    deleteScheduleEvent(scheduleEventId: string): Promise<void>;
    getEventTypeList(): Array<{
        eventType: string;
        displayName: string;
        displayDescription: string
    }>;
}
