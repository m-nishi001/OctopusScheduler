import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/entity/schedule-event";
import { TransitionPageDetail } from "../../../domains/schedule-event/entity/events/transition-page-event";

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
}
