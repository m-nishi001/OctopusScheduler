import { injectable } from "tsyringe";
import type { IScheduleEventEntity } from "../../../domains/schedule-event/i-schedule-event-entity";
import { TransitionPageDetail } from "../../../domains/schedule-event/transition-page-event/transition-page-event-entity";
import { TransitionPageEventEntity } from "../../../domains/schedule-event/transition-page-event/transition-page-event-entity";

@injectable()
export class TransitionPageEventConverter {
  toDto(event: IScheduleEventEntity): TransitionPageDetail {
    return event.detail as TransitionPageDetail;
  }

  toEntity(
    detail: TransitionPageDetail,
    baseEvent: Omit<IScheduleEventEntity, "detail">
  ): IScheduleEventEntity {
    return {
      ...baseEvent,
      detail,
    };
  }

  toTransitionPageEventDto(
    event: IScheduleEventEntity
  ): TransitionPageEventEntity {
    return new TransitionPageEventEntity(
      event.id,
      event.timeSpan,
      event.detail as TransitionPageDetail,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}
