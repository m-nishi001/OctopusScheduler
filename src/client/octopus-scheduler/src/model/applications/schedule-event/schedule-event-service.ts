import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEventDto } from "./i-schedule-event-dto";
import { ScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable, inject } from "tsyringe";
import { PlayAudioEventConverter } from "./play-audio-event/play-audio-event-converter";
import { ShowContentEventConverter } from "./show-content-event/show-content-event-converter";
import { TransitionPageEventConverter } from "./transition-page-event/transition-page-event-converter";

@injectable()
export class ScheduleEventService {
  constructor(
    @inject("IScheduleEventRepository")
    private scheduleEventRepository: IScheduleEventRepository,
    @inject("PlayAudioEventConverter")
    private playAudioConverter: PlayAudioEventConverter,
    @inject("ShowContentEventConverter")
    private showContentConverter: ShowContentEventConverter,
    @inject("TransitionPageEventConverter")
    private transitionPageConverter: TransitionPageEventConverter
  ) {}

  private deserialize(scheduleEvent: ScheduleEvent): IScheduleEventDto {
    const records = JSON.parse(scheduleEvent.settingValue) as Record<
      string,
      string
    >;
    switch (scheduleEvent.type) {
      case "PlayAudioEvent":
        return this.playAudioConverter.toEntity(records);
      case "ShowContentEvent":
        return this.showContentConverter.toEntity(records);
      case "TransitionPageEvent":
        return this.transitionPageConverter.toEntity(records);
      default:
        throw new Error(`Unknown event type: ${scheduleEvent.type}`);
    }
  }

  private serialize(event: IScheduleEventDto): ScheduleEvent {
    const records = event.toRecords();
    return new ScheduleEvent(
      event.id,
      event.type,
      "records",
      JSON.stringify(Object.fromEntries(records))
    );
  }

  async getScheduleEvents(): Promise<IScheduleEventDto[]> {
    const scheduleEvents =
      await this.scheduleEventRepository.getScheduleEvents();
    return scheduleEvents.map((e) => this.deserialize(e));
  }

  async updateScheduleEvents(events: IScheduleEventDto[]): Promise<void> {
    const scheduleEvents = events.map((e) => this.serialize(e));
    await this.scheduleEventRepository.updateScheduleEvents(scheduleEvents);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.scheduleEventRepository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: IScheduleEventDto[]): Promise<string[]> {
    const scheduleEvents = events.map((e) => this.serialize(e));
    return await this.scheduleEventRepository.addScheduleEvents(scheduleEvents);
  }

  async getCurrentScheduleEvent(): Promise<{
    startEvents: IScheduleEventDto[];
    endEvents: IScheduleEventDto[];
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
