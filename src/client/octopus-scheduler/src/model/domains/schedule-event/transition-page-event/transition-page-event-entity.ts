import type { IScheduleEventEntity } from "../i-schedule-event-entity";
import { ScheduleTimeSpan } from "../schedule-timespan";

export class TransitionPageEventEntity implements IScheduleEventEntity {
  public readonly id: string;
  public readonly type: string = "TransitionPageEvent";
  public readonly timeSpan: ScheduleTimeSpan;
  public readonly transitionUrl: string;
  public readonly fadeOutDuration?: number;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    timeSpan: ScheduleTimeSpan,
    transitionUrl: string,
    fadeOutDuration: number | undefined,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.timeSpan = timeSpan;
    this.transitionUrl = transitionUrl;
    this.fadeOutDuration = fadeOutDuration;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
  }

  toRecords(): Map<string, string> {
    return new Map([
      ["id", this.id],
      ["type", this.type],
      ["timeSpan.start", this.timeSpan.start.toISOString()],
      ["timeSpan.end", this.timeSpan.end.toISOString()],
      ["transitionUrl", this.transitionUrl],
      ["fadeOutDuration", this.fadeOutDuration?.toString() ?? ""],
      ["processedAt", this.processedAt ? this.processedAt.toISOString() : ""],
      ["registeredAt", this.registeredAt.toISOString()],
      ["updatedAt", this.updatedAt.toISOString()],
    ]);
  }
}
