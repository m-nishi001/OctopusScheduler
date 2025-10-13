import { ScheduleEventDto } from "../entity/schedule-event";

export interface IScheduleEventRepository {
  getScheduleEvents(): Promise<ScheduleEventDto[]>;
  updateScheduleEvents(events: ScheduleEventDto[]): Promise<void>;
  deleteScheduleEvents(ids: string[]): Promise<void>;
  addScheduleEvents(events: ScheduleEventDto[]): Promise<void>;
}
