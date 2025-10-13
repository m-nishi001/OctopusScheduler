import { injectable } from "tsyringe";
import type { IScheduleEventDto } from "../i-schedule-event-dto";
import { SlideshowEventDto } from "./slideshow-event-dto";

@injectable()
export class SlideshowEventConverter {
  toEntity(records: Record<string, string>): IScheduleEventDto {
    return new SlideshowEventDto(
      records.id,
      new Date(records.startTime),
      new Date(records.endTime),
      records.folderId,
      parseInt(records.displayDuration),
      records.transitionType as "fade" | "slide",
      records.slideDirection as "left" | "right" | "up" | "down" | undefined,
      records.bgmIds ? records.bgmIds.split(",") : [],
      records.processedAt ? new Date(records.processedAt) : null,
      new Date(records.registeredAt),
      new Date(records.updatedAt)
    );
  }
}
