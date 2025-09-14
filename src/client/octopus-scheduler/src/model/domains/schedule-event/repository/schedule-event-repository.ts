import type { IScheduleEvent } from "../entity/schedule-event";

export interface IScheduleEventRepository {
    add(scheduleEvent: IScheduleEvent): Promise<void>;
    findById(scheduleEventId: string): Promise<IScheduleEvent | null>;
    findAll(): Promise<IScheduleEvent[]>;
    update(scheduleEvent: IScheduleEvent): Promise<void>;
    delete(scheduleEventId: string): Promise<void>;
    fetchLatestEvents(): Promise<{ startedEvents: IScheduleEvent[]; endedEvents: IScheduleEvent[] }>;
}