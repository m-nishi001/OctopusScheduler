import { injectable } from "tsyringe";
import type { IScheduleEventDto } from "../i-schedule-event-dto";
import { TransitionPageEventDto } from "./transition-page-event-dto";

@injectable()
export class TransitionPageEventConverter {
  toEntity(records: Record<string, string>): IScheduleEventDto {
    return new TransitionPageEventDto(
      records.id,
      new Date(records.startTime),
      new Date(records.endTime),
      records.transitionUrl,
      records.fadeOutDuration ? parseInt(records.fadeOutDuration) : undefined,
      records.processedAt ? new Date(records.processedAt) : null,
      new Date(records.registeredAt),
      new Date(records.updatedAt)
    );
  }
}
