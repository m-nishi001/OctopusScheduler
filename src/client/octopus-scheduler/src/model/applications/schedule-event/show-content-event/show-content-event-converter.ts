import { injectable } from "tsyringe";
import type { IScheduleEventEntity } from "../../../domains/schedule-event/i-schedule-event-entity";
import { ShowContentEventEntity } from "../../../domains/schedule-event/show-content-event/show-content-event-entity";

export interface ShowContentEventDetail {
  contentType: "image" | "movie" | "html";
  contentId?: string;
  htmlString?: string;
  fadeOutDuration?: number;
}

@injectable()
export class ShowContentEventConverter {
  toDto(event: IScheduleEventEntity): ShowContentEventDetail {
    const showContentEvent = event as ShowContentEventEntity;
    return {
      contentType: showContentEvent.contentType,
      contentId: showContentEvent.contentId,
      htmlString: showContentEvent.htmlString,
      fadeOutDuration: showContentEvent.fadeOutDuration,
    };
  }

  toEntity(
    detail: ShowContentEventDetail,
    baseEvent: Omit<IScheduleEventEntity, "detail">
  ): IScheduleEventEntity {
    return new ShowContentEventEntity(
      baseEvent.id,
      baseEvent.timeSpan,
      detail.contentType,
      detail.contentId,
      detail.htmlString,
      detail.fadeOutDuration,
      baseEvent.processedAt,
      baseEvent.registeredAt,
      baseEvent.updatedAt
    );
  }

  toShowContentEventDto(event: IScheduleEventEntity): ShowContentEventEntity {
    const showContentEvent = event as ShowContentEventEntity;
    return new ShowContentEventEntity(
      event.id,
      event.timeSpan,
      showContentEvent.contentType,
      showContentEvent.contentId,
      showContentEvent.htmlString,
      showContentEvent.fadeOutDuration,
      event.processedAt,
      event.registeredAt,
      event.updatedAt
    );
  }
}
