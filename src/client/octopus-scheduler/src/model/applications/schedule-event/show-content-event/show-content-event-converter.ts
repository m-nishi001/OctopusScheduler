import { injectable } from "tsyringe";
import type { IScheduleEventEntity } from "../../../domains/schedule-event/i-schedule-event-entity";
import { ShowContentEventDetail } from "../../../domains/schedule-event/show-content-event/show-content-event-entity";
import { ShowContentEventEntity } from "../../../domains/schedule-event/show-content-event/show-content-event-entity";

@injectable()
export class ShowContentEventConverter {
  toDto(event: IScheduleEventEntity): ShowContentEventDetail {
    return event.detail as ShowContentEventDetail;
  }

  toEntity(
    detail: ShowContentEventDetail,
    baseEvent: Omit<IScheduleEventEntity, "detail">
  ): IScheduleEventEntity {
    return {
      ...baseEvent,
      detail,
    };
  }

  toShowContentEventDto(event: IScheduleEventEntity): ShowContentEventEntity {
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
