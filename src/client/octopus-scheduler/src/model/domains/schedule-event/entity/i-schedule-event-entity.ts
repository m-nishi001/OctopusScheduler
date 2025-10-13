import type { ScheduleTimeSpan } from "../vo/schedule-timespan";

export interface IScheduleEventEntity {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly timeSpan: ScheduleTimeSpan;
  readonly detail: any;
  readonly processedAt: Date | null;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
}
