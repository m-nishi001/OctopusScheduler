import type { ScheduleEvent } from "./schedule-event";

export interface IScheduleEventRepository {
  getScheduleEvents(): Promise<ScheduleEvent[]>;
  updateScheduleEvents(events: ScheduleEvent[]): Promise<void>;
  deleteScheduleEvents(ids: string[]): Promise<void>;
  addScheduleEvents(events: ScheduleEvent[]): Promise<string[]>;
  syncScheduleEvents(): Promise<void>;
  getExecutionStatus(eventId: string): Promise<string | null>;
  updateExecutionStatus(eventId: string, status: string): Promise<void>;
  getAllExecutionStatuses(): Promise<{ [eventId: string]: string }>;
  markEventAsStarted(eventId: string): Promise<void>;
  markEventAsCompleted(eventId: string): Promise<void>;
  markEventAsFailed(eventId: string): Promise<void>;
}
