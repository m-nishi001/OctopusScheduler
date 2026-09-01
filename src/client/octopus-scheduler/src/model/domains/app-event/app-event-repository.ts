import type { IAppEvent } from "./app-event";
import type { ExecutionStatus } from "./execution-status";

export interface IAppEventRepository {
  getScheduleEvents(): Promise<IAppEvent[]>;
  updateScheduleEvents(events: IAppEvent[]): Promise<void>;
  deleteScheduleEvents(ids: string[]): Promise<void>;
  addScheduleEvents(events: IAppEvent[]): Promise<string>;
  syncScheduleEvents(mode?: "local" | "gas"): Promise<void>;
  getEventById(id: string): Promise<IAppEvent | null>;
  getExecutionStatus(eventId: string): Promise<ExecutionStatus | null>;
  updateExecutionStatus(
    eventId: string,
    status: ExecutionStatus
  ): Promise<void>;
  getAllExecutionStatuses(): Promise<{ [eventId: string]: ExecutionStatus }>;
}

export const IAppEventRepositoryToken = Symbol("IAppEventRepository");
