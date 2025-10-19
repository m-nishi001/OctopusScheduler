import type { IScheduleEvent } from "./schedule-event";
import type { ExecutionStatus } from "./execution-status";

export interface IScheduleEventRepository {
  getScheduleEvents(): Promise<IScheduleEvent[]>;
  updateScheduleEvents(events: IScheduleEvent[]): Promise<void>;
  deleteScheduleEvents(ids: string[]): Promise<void>;
  addScheduleEvents(events: IScheduleEvent[]): Promise<string>;
  syncScheduleEvents(): Promise<void>;
  getExecutionStatus(eventId: string): Promise<ExecutionStatus | null>;
  updateExecutionStatus(
    eventId: string,
    status: ExecutionStatus
  ): Promise<void>;
  getAllExecutionStatuses(): Promise<{ [eventId: string]: ExecutionStatus }>;
}
