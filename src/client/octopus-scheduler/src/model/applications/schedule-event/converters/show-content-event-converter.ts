import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/entity/schedule-event";
import { ShowContentEventDetail } from "../../../domains/schedule-event/entity/events/show-content-event";

@injectable()
export class ShowContentEventConverter {
  toDto(event: ScheduleEventDto): ShowContentEventDetail {
    return event.detail as ShowContentEventDetail;
  }

  toEntity(
    detail: ShowContentEventDetail,
    baseEvent: Omit<ScheduleEventDto, "detail">
  ): ScheduleEventDto {
    return {
      ...baseEvent,
      detail,
    };
  }
}
