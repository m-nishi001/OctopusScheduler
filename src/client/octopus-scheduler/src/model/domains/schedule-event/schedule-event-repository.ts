import type { IScheduleEventEntity } from "./i-schedule-event-entity";

export interface IScheduleEventRepository {
  getScheduleEvents(): Promise<IScheduleEventEntity[]>;
  updateScheduleEvents(events: IScheduleEventEntity[]): Promise<void>;
  deleteScheduleEvents(ids: string[]): Promise<void>;
  addScheduleEvents(events: IScheduleEventEntity[]): Promise<string[]>;
}
