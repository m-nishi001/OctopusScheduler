import { injectable } from "tsyringe";
import type { IScheduleEventEntity } from "../i-schedule-event-entity";
import { PlayAudioEventEntity } from "./play-audio-event-entity";

export interface PlayAudioEventDetail {
  audioId: string;
  fadeOutDuration?: number;
}

@injectable()
export class PlayAudioEventConverter {
  toDto(event: IScheduleEventEntity): PlayAudioEventDetail {
    const playAudioEvent = event as PlayAudioEventEntity;
    return {
      audioId: playAudioEvent.audioId,
      fadeOutDuration: playAudioEvent.fadeOutDuration,
    };
  }

  toEntity(
    detail: PlayAudioEventDetail,
    baseEvent: Omit<IScheduleEventEntity, "detail">
  ): IScheduleEventEntity {
    return new PlayAudioEventEntity(
      baseEvent.id,
      baseEvent.startTime,
      baseEvent.endTime,
      detail.audioId,
      detail.fadeOutDuration,
      baseEvent.processedAt,
      baseEvent.registeredAt,
      baseEvent.updatedAt
    );
  }

  toPlayAudioEventDto(event: IScheduleEventEntity): PlayAudioEventEntity {
    const playAudioEvent = event as PlayAudioEventEntity;
    return new PlayAudioEventEntity(
      event.id,
      event.startTime,
      event.endTime,
      playAudioEvent.audioId,
      playAudioEvent.fadeOutDuration,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}
