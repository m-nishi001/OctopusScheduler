import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/entity/schedule-event";
import { ShowImageEventDetail } from "../../../domains/schedule-event/entity/events/show-image-event";

@injectable()
export class ShowImageEventConverter {
  toDto(event: ScheduleEventDto): ShowImageEventDetail {
    return event.detail as ShowImageEventDetail;
  }

  toEntity(
    detail: ShowImageEventDetail,
    baseEvent: Omit<ScheduleEventDto, "detail">
  ): ScheduleEventDto {
    return {
      ...baseEvent,
      detail,
    };
  }
}
