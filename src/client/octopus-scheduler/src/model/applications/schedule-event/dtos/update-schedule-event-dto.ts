import type { CreateScheduleEventDto } from './create-schedule-event-dto';

export interface UpdateScheduleEventDto extends CreateScheduleEventDto {
    scheduleEventId: string;
}
