import { ScheduleEventDto } from "../schedule-event";
import { ScheduleTimeSpan } from "../../vo/schedule-timespan";

export class PlayAudioEventEntity extends ScheduleEventDto {
  public readonly detail: PlayAudioEventDetail;

  constructor(
    id: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: PlayAudioEventDetail,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    super(
      id,
      "PlayAudioEvent",
      name,
      timeSpan,
      detail,
      processedAt,
      registeredAt,
      updatedAt
    );
    this.detail = detail;
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
