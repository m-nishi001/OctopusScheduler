import type { ScheduleTimeSpan } from "./schedule-timespan";

export interface IScheduleEventEntity {
  readonly id: string;
  readonly type: string;
  readonly timeSpan: ScheduleTimeSpan;
  readonly processedAt: Date | null;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
  toRecords(): Map<string, string>;
}
