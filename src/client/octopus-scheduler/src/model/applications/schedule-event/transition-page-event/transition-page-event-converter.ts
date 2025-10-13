import { injectable } from "tsyringe";
import type { IScheduleEventEntity } from "../i-schedule-event-entity";
import { TransitionPageEventEntity } from "./transition-page-event-entity";

export interface TransitionPageDetail {
  transitionUrl: string;
  fadeOutDuration?: number;
}

@injectable()
export class TransitionPageEventConverter {
  toDto(event: IScheduleEventEntity): TransitionPageDetail {
    const transitionPageEvent = event as TransitionPageEventEntity;
    return {
      transitionUrl: transitionPageEvent.transitionUrl,
      fadeOutDuration: transitionPageEvent.fadeOutDuration,
    };
  }

  toEntity(
    detail: TransitionPageDetail,
    baseEvent: Omit<IScheduleEventEntity, "detail">
  ): IScheduleEventEntity {
    return new TransitionPageEventEntity(
      baseEvent.id,
      baseEvent.startTime,
      baseEvent.endTime,
      detail.transitionUrl,
      detail.fadeOutDuration,
      baseEvent.processedAt,
      baseEvent.registeredAt,
      baseEvent.updatedAt
    );
  }

  toTransitionPageEventDto(
    event: IScheduleEventEntity
  ): TransitionPageEventEntity {
    const transitionPageEvent = event as TransitionPageEventEntity;
    return new TransitionPageEventEntity(
      event.id,
      event.startTime,
      event.endTime,
      transitionPageEvent.transitionUrl,
      transitionPageEvent.fadeOutDuration,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}
