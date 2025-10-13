import type { ScheduleEvent } from "./schedule-event";

export interface IScheduleEventRepository {
  getScheduleEvents(): Promise<ScheduleEvent[]>;
  updateScheduleEvents(events: ScheduleEvent[]): Promise<void>;
  deleteScheduleEvents(ids: string[]): Promise<void>;
  addScheduleEvents(events: ScheduleEvent[]): Promise<string[]>;
  syncScheduleEvents(): Promise<void>;
}
