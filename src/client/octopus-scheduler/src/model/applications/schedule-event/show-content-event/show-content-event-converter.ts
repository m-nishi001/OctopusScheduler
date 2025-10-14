import { injectable } from "tsyringe";
import type { IScheduleEventDto } from "../i-schedule-event-dto";
import { ShowContentEventDto } from "./show-content-event-dto";

@injectable()
export class ShowContentEventConverter {
  toEntity(records: Record<string, string>): IScheduleEventDto {
    return new ShowContentEventDto(
      records.id,
      new Date(records.startTime),
      new Date(records.endTime),
      records.contentType as "image" | "movie" | "html",
      records.contentId || undefined,
      records.htmlString || undefined,
      records.fadeOutDuration ? parseInt(records.fadeOutDuration) : undefined,
      records.displayMode as "fade" | "scroll-up" | "scroll-down" | undefined,
      records.effect as "fade" | "scroll" | "static" | undefined,
      records.duration ? parseInt(records.duration) : undefined,
      records.fadeInTime ? parseFloat(records.fadeInTime) : undefined,
      records.fadeOutTime ? parseFloat(records.fadeOutTime) : undefined,
      records.scrollDirection as "up" | "down" | "left" | "right" | undefined,
      records.processedAt ? new Date(records.processedAt) : null,
      new Date(records.registeredAt),
      new Date(records.updatedAt)
    );
  }
}
