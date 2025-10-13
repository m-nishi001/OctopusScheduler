import { injectable } from "tsyringe";
import type { IScheduleEventEntity } from "../../../domains/schedule-event/i-schedule-event-entity";
import { PlayAudioEventEntity } from "../../../domains/schedule-event/play-audio-event/play-audio-event-entity";

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
      baseEvent.timeSpan,
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
      event.timeSpan,
      playAudioEvent.audioId,
      playAudioEvent.fadeOutDuration,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}
