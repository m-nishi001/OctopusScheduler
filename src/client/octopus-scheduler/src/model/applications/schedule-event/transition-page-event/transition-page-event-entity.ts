import type { IScheduleEventEntity } from "../i-schedule-event-entity";
import { eventBus } from "../../../../core/event-bus";

export class TransitionPageEventEntity implements IScheduleEventEntity {
  public readonly id: string;
  public readonly type: string = "TransitionPageEvent";
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly transitionUrl: string;
  public readonly fadeOutDuration?: number;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    startTime: Date,
    endTime: Date,
    transitionUrl: string,
    fadeOutDuration: number | undefined,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.transitionUrl = transitionUrl;
    this.fadeOutDuration = fadeOutDuration;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
  }

  async execute(isStart: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("transitionPage", { transitionUrl: this.transitionUrl });
    }
  }

  toRecords(): Map<string, string> {
    return new Map([
      ["id", this.id],
      ["type", this.type],
      ["startTime", this.startTime.toISOString()],
      ["endTime", this.endTime.toISOString()],
      ["transitionUrl", this.transitionUrl],
      ["fadeOutDuration", this.fadeOutDuration?.toString() ?? ""],
      ["processedAt", this.processedAt ? this.processedAt.toISOString() : ""],
      ["registeredAt", this.registeredAt.toISOString()],
      ["updatedAt", this.updatedAt.toISOString()],
    ]);
  }
}
