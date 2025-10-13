import { ScheduleEvent } from "./entity/schedule-event";

export interface IScheduleEventRepository {
  getScheduleEvents(): ScheduleEvent[];
  updateScheduleEvents(events: ScheduleEvent[]): void;
  deleteScheduleEvents(ids: string[]): void;
  addScheduleEvents(events: ScheduleEvent[]): void;
}
