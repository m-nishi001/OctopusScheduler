import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/entity/schedule-event";
import { TransitionPageDetail } from "../../../domains/schedule-event/entity/events/transition-page-event";
import { TransitionPageEventDto } from "./transition-page-event-dto";

@injectable()
export class TransitionPageEventConverter {
  toDto(event: ScheduleEventDto): TransitionPageDetail {
    return event.detail as TransitionPageDetail;
  }

  toEntity(
    detail: TransitionPageDetail,
    baseEvent: Omit<ScheduleEventDto, "detail">
  ): ScheduleEventDto {
    return {
      ...baseEvent,
      detail,
    };
  }

  toTransitionPageEventDto(event: ScheduleEventDto): TransitionPageEventDto {
    return new TransitionPageEventDto(
      event.id,
      event.name,
      event.timeSpan,
      event.detail as TransitionPageDetail,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}