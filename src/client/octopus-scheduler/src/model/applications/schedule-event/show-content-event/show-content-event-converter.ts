import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/entity/schedule-event";
import { ShowContentEventDetail } from "../../../domains/schedule-event/entity/events/show-content-event";
import { ShowContentEventEntity } from "../../../domains/schedule-event/entity/show-content-event-entity";

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

  toShowContentEventDto(event: ScheduleEventDto): ShowContentEventEntity {
    return new ShowContentEventEntity(
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
