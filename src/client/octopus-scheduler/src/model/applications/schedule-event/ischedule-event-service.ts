import type { EventDto } from "./dtos/event-dto";
import type { EventTypeDto } from "./dtos/event-type-dto";

import type { CreateScheduleEventDto } from "./dtos/create-schedule-event-dto";
import type { UpdateScheduleEventDto } from "./dtos/update-schedule-event-dto";

export interface IScheduleEventService {
    createScheduleEvent(dto: CreateScheduleEventDto): Promise<EventDto | null>;
    getScheduleEventById(scheduleEventId: string): Promise<EventDto | null>;
    getAllScheduleEvents(): Promise<EventDto[]>;
    getCurrentScheduleEvent(): Promise<{
        startEvents: EventDto[],
        endEvents: EventDto[]
    }>;
    deleteScheduleEvent(scheduleEventId: string): Promise<void>;
    getEventTypeList(): Promise<EventTypeDto[]>;
    updateScheduleEvent(dto: UpdateScheduleEventDto): Promise<EventDto | null>;
    markEventsAsStarted(args: { scheduleEventIds: string[] }): Promise<void>;
    markEventsAsEnded(args: { scheduleEventIds: string[] }): Promise<void>;
}
