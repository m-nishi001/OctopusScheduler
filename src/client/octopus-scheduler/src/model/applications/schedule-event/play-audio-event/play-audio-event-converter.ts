import { injectable } from "tsyringe";
import type { IScheduleEventEntity } from "../../../domains/schedule-event/i-schedule-event-entity";
import { PlayAudioEventDetail } from "../../../domains/schedule-event/play-audio-event/play-audio-event-entity";
import { PlayAudioEventEntity } from "../../../domains/schedule-event/play-audio-event/play-audio-event-entity";

@injectable()
export class PlayAudioEventConverter {
  toDto(event: IScheduleEventEntity): PlayAudioEventDetail {
    return event.detail as PlayAudioEventDetail;
  }

  toEntity(
    detail: PlayAudioEventDetail,
    baseEvent: Omit<IScheduleEventEntity, "detail">
  ): IScheduleEventEntity {
    return {
      ...baseEvent,
      detail,
    };
  }

  toPlayAudioEventDto(event: IScheduleEventEntity): PlayAudioEventEntity {
    return new PlayAudioEventEntity(
      event.id,
      event.timeSpan,
      event.detail as PlayAudioEventDetail,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}
