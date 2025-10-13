import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/schedule-event";
import { ShowContentEventDetail } from "../../../domains/schedule-event/show-content-event/show-content-event-entity";
import { ShowContentEventEntity } from "../../../domains/schedule-event/show-content-event/show-content-event-entity";

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
