import type { ScheduleTimeSpan } from "./schedule-timespan";

export class ScheduleEventDto {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  public readonly timeSpan: ScheduleTimeSpan;
  public readonly detail: any;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    type: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: any,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.timeSpan = timeSpan;
    this.detail = detail;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
  }
}
