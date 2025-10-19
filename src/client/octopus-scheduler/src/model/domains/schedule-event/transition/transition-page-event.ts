import { eventBus } from "../../../../core/event-bus";
import type { IScheduleEvent } from "../schedule-event";

export class TransitionPageEvent implements IScheduleEvent {
  public readonly id: string;
  public readonly type: string = "TransitionPageEvent";
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly transitionUrl: string;
  public readonly fadeOutDuration?: number;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(params: {
    id: string;
    startTime: Date;
    endTime: Date;
    transitionUrl: string;
    fadeOutDuration?: number;
    processedAt: Date | null;
    registeredAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.transitionUrl = params.transitionUrl;
    this.fadeOutDuration = params.fadeOutDuration;
    this.processedAt = params.processedAt;
    this.registeredAt = params.registeredAt;
    this.updatedAt = params.updatedAt;
  }

  async execute(isStart: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("transitionPage", { transitionUrl: this.transitionUrl });
    }
  }

  serialize(): string[] {
    return [
      this.startTime.toISOString(),
      this.endTime.toISOString(),
      this.transitionUrl,
      this.fadeOutDuration?.toString() ?? "",
      this.processedAt ? this.processedAt.toISOString() : "",
      this.registeredAt.toISOString(),
      this.updatedAt.toISOString(),
    ];
  }
}
