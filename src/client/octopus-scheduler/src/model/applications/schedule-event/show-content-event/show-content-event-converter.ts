import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/entity/schedule-event";
import { ShowContentEventDetail } from "../../../domains/schedule-event/entity/events/show-content-event";
import { ShowContentEventDto } from "./show-content-event-dto";

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

  toShowContentEventDto(event: ScheduleEventDto): ShowContentEventDto {
    return new ShowContentEventDto(
      event.id,
      event.name,
      event.timeSpan,
      event.detail as ShowContentEventDetail,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}