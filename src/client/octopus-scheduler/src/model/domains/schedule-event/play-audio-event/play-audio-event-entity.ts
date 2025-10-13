import type { IScheduleEventEntity } from "../i-schedule-event-entity";
import { ScheduleTimeSpan } from "../schedule-timespan";

export class PlayAudioEventEntity implements IScheduleEventEntity {
  public readonly id: string;
  public readonly type: string = "PlayAudioEvent";
  public readonly name: string;
  public readonly timeSpan: ScheduleTimeSpan;
  public readonly detail: PlayAudioEventDetail;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: PlayAudioEventDetail,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.name = name;
    this.timeSpan = timeSpan;
    this.detail = detail;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
  }
}

export class PlayAudioEventDetail {
  readonly audioId: string;
  readonly fadeOutDuration?: number;

  constructor(audioId: string, fadeOutDuration?: number) {
    this.audioId = audioId;
    this.fadeOutDuration = fadeOutDuration;
  }
}
