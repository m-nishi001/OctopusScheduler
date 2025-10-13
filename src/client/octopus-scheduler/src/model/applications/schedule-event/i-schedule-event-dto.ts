import type { ScheduleTimeSpan } from "../../domains/schedule-event/vo/schedule-timespan";

export interface IScheduleEventDto {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly timeSpan: ScheduleTimeSpan;
  readonly detail: any;
  readonly processedAt: Date | null;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
}