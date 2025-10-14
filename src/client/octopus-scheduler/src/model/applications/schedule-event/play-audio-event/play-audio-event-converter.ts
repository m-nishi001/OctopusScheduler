import { injectable } from "tsyringe";
import type { IScheduleEventDto } from "../i-schedule-event-dto";
import { PlayAudioEventDto } from "./play-audio-event-dto";
import type { IScheduleEventConverter } from "../i-schedule-event-converter";

@injectable()
export class PlayAudioEventConverter implements IScheduleEventConverter {
  toEntity(records: Record<string, string>): IScheduleEventDto {
    return new PlayAudioEventDto(
      records.id,
      new Date(records.startTime),
      new Date(records.endTime),
      records.audioId,
      records.fadeOutDuration ? parseInt(records.fadeOutDuration) : undefined,
      records.processedAt ? new Date(records.processedAt) : null,
      new Date(records.registeredAt),
      new Date(records.updatedAt)
    );
  }
}
