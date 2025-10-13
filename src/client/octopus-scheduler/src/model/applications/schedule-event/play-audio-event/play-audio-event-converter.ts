import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/entity/schedule-event";
import { PlayAudioEventDetail } from "../../../domains/schedule-event/entity/events/play-audio-event";
import { PlayAudioEventDto } from "./play-audio-event-dto";

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

  toPlayAudioEventDto(event: ScheduleEventDto): PlayAudioEventDto {
    return new PlayAudioEventDto(
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