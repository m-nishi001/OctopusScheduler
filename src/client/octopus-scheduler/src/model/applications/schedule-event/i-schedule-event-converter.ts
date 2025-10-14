import type { IScheduleEventDto } from "./i-schedule-event-dto";

export interface IScheduleEventConverter {
  toEntity(records: Record<string, string>): IScheduleEventDto;
}
