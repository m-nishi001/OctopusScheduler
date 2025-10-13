import type { ScheduleEvent } from "./schedule-event";
import type { ScheduleEventExecutionStatus } from "./execution-status";

export interface IScheduleEventRepository {
  getScheduleEvents(): Promise<ScheduleEvent[]>;
  updateScheduleEvents(events: ScheduleEvent[]): Promise<void>;
  deleteScheduleEvents(ids: string[]): Promise<void>;
  addScheduleEvents(events: ScheduleEvent[]): Promise<string[]>;
  syncScheduleEvents(): Promise<void>;
  getExecutionStatus(
    eventId: string
  ): Promise<ScheduleEventExecutionStatus | null>;
  updateExecutionStatus(status: ScheduleEventExecutionStatus): Promise<void>;
  getAllExecutionStatuses(): Promise<ScheduleEventExecutionStatus[]>;
  markEventAsStarted(eventId: string): Promise<void>;
  markEventAsCompleted(eventId: string): Promise<void>;
  markEventAsFailed(eventId: string, errorMessage: string): Promise<void>;
}
