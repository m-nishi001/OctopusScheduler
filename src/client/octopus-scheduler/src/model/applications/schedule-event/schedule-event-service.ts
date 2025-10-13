import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEventEntity } from "./i-schedule-event-entity";
import { ScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { PlayAudioEventEntity } from "./play-audio-event/play-audio-event-entity";
import { ShowContentEventEntity } from "./show-content-event/show-content-event-entity";
import { TransitionPageEventEntity } from "./transition-page-event/transition-page-event-entity";
import { injectable, inject } from "tsyringe";

@injectable()
export class ScheduleEventService {
  constructor(
    @inject("IScheduleEventRepository")
    private scheduleEventRepository: IScheduleEventRepository
  ) {}

  private deserialize(scheduleEvent: ScheduleEvent): IScheduleEventEntity {
    const records = JSON.parse(scheduleEvent.settingValue) as Record<
      string,
      string
    >;
    switch (scheduleEvent.type) {
      case "PlayAudioEvent":
        return new PlayAudioEventEntity(
          records.id,
          new Date(records.startTime),
          new Date(records.endTime),
          records.audioId,
          records.fadeOutDuration
            ? parseInt(records.fadeOutDuration)
            : undefined,
          records.processedAt ? new Date(records.processedAt) : null,
          new Date(records.registeredAt),
          new Date(records.updatedAt)
        );
      case "ShowContentEvent":
        return new ShowContentEventEntity(
          records.id,
          new Date(records.startTime),
          new Date(records.endTime),
          records.contentType as "image" | "movie" | "html",
          records.contentId || undefined,
          records.htmlString || undefined,
          records.fadeOutDuration
            ? parseInt(records.fadeOutDuration)
            : undefined,
          records.processedAt ? new Date(records.processedAt) : null,
          new Date(records.registeredAt),
          new Date(records.updatedAt)
        );
      case "TransitionPageEvent":
        return new TransitionPageEventEntity(
          records.id,
          new Date(records.startTime),
          new Date(records.endTime),
          records.transitionUrl,
          records.fadeOutDuration
            ? parseInt(records.fadeOutDuration)
            : undefined,
          records.processedAt ? new Date(records.processedAt) : null,
          new Date(records.registeredAt),
          new Date(records.updatedAt)
        );
      default:
        throw new Error(`Unknown event type: ${scheduleEvent.type}`);
    }
  }

  private serialize(event: IScheduleEventEntity): ScheduleEvent {
    const records = event.toRecords();
    return new ScheduleEvent(
      event.id,
      event.type,
      "records",
      JSON.stringify(Object.fromEntries(records))
    );
  }

  async getScheduleEvents(): Promise<IScheduleEventEntity[]> {
    const scheduleEvents =
      await this.scheduleEventRepository.getScheduleEvents();
    return scheduleEvents.map((e) => this.deserialize(e));
  }

  async updateScheduleEvents(events: IScheduleEventEntity[]): Promise<void> {
    const scheduleEvents = events.map((e) => this.serialize(e));
    await this.scheduleEventRepository.updateScheduleEvents(scheduleEvents);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.scheduleEventRepository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: IScheduleEventEntity[]): Promise<string[]> {
    const scheduleEvents = events.map((e) => this.serialize(e));
    return await this.scheduleEventRepository.addScheduleEvents(scheduleEvents);
  }

  async getCurrentScheduleEvent(): Promise<{
    startEvents: IScheduleEventEntity[];
    endEvents: IScheduleEventEntity[];
  }> {
    const events = await this.getScheduleEvents();
    const now = new Date();
    const startEvents = events.filter(
      (e) => e.startTime <= now && now < e.endTime && e.processedAt === null
    );
    const endEvents = events.filter(
      (e) =>
        e.endTime <= now && e.processedAt !== null && e.registeredAt === null
    );
    return { startEvents, endEvents };
  }

  async markEventsAsStarted(scheduleEventIds: string[]): Promise<void> {
    const events = await this.getScheduleEvents();
    const now = new Date();
    const updated = events.map((e) =>
      scheduleEventIds.includes(e.id)
        ? {
            ...e,
            processedAt: now,
            updatedAt: now,
          }
        : e
    );
    await this.updateScheduleEvents(updated);
  }

  async markEventsAsEnded(scheduleEventIds: string[]): Promise<void> {
    const events = await this.getScheduleEvents();
    const now = new Date();
    const updated = events.map((e) =>
      scheduleEventIds.includes(e.id)
        ? {
            ...e,
            registeredAt: now,
            updatedAt: now,
          }
        : e
    );
    await this.updateScheduleEvents(updated);
  }

  async syncScheduleEvents(): Promise<void> {
    await this.scheduleEventRepository.syncScheduleEvents();
  }
}
