import type { IScheduleEvent } from "./schedule-event";

export interface IScheduleEventRepository {
  getScheduleEvents(): Promise<IScheduleEvent[]>;
  updateScheduleEvents(events: IScheduleEvent[]): Promise<void>;
  deleteScheduleEvents(ids: string[]): Promise<void>;
  addScheduleEvents(events: IScheduleEvent[]): Promise<string>;
  syncScheduleEvents(): Promise<void>;
  getExecutionStatus(eventId: string): Promise<string | null>;
  updateExecutionStatus(eventId: string, status: string): Promise<void>;
  getAllExecutionStatuses(): Promise<{ [eventId: string]: string }>;
  markEventAsStarted(eventId: string): Promise<void>;
  markEventAsCompleted(eventId: string): Promise<void>;
  markEventAsFailed(eventId: string): Promise<void>;
}
