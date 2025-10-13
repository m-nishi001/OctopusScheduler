import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/schedule-event";
import { PlayAudioEventDetail } from "../../../domains/schedule-event/play-audio-event/play-audio-event-entity";
import { PlayAudioEventEntity } from "../../../domains/schedule-event/play-audio-event/play-audio-event-entity";

@injectable()
export class PlayAudioEventConverter {
  toDto(event: ScheduleEventDto): PlayAudioEventDetail {
    return event.detail as PlayAudioEventDetail;
  }

  toEntity(
    detail: PlayAudioEventDetail,
    baseEvent: Omit<ScheduleEventDto, "detail">
  ): ScheduleEventDto {
    return {
      ...baseEvent,
      detail,
    };
  }

  toPlayAudioEventDto(event: ScheduleEventDto): PlayAudioEventEntity {
    return new PlayAudioEventEntity(
      event.id,
      event.name,
      event.timeSpan,
      event.detail as PlayAudioEventDetail,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}
