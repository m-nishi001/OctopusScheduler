import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import { ScheduleEventDto } from "../../domains/schedule-event/schedule-event";
import { injectable, inject } from "tsyringe";

@injectable()
export class ScheduleEventService {
  constructor(
    @inject("IScheduleEventRepository")
    private scheduleEventRepository: IScheduleEventRepository
  ) {}

  async getScheduleEvents(): Promise<ScheduleEventDto[]> {
    return await this.scheduleEventRepository.getScheduleEvents();
  }

  async updateScheduleEvents(events: ScheduleEventDto[]): Promise<void> {
    await this.scheduleEventRepository.updateScheduleEvents(events);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.scheduleEventRepository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: ScheduleEventDto[]): Promise<void> {
    await this.scheduleEventRepository.addScheduleEvents(events);
  }

  async getCurrentScheduleEvent(): Promise<{
    startEvents: ScheduleEventDto[];
    endEvents: ScheduleEventDto[];
  }> {
    const events = await this.getScheduleEvents();
    const now = new Date();
    const startEvents = events.filter(
      (e) =>
        e.timeSpan.start <= now &&
        now < e.timeSpan.end &&
        e.processedAt === null
    );
    const endEvents = events.filter(
      (e) =>
        e.timeSpan.end <= now &&
        e.processedAt !== null &&
        e.registeredAt === null
    );
    return { startEvents, endEvents };
  }

  async markEventsAsStarted(scheduleEventIds: string[]): Promise<void> {
    const events = await this.getScheduleEvents();
    const now = new Date();
    const updated = events.map((e) =>
      scheduleEventIds.includes(e.id)
        ? new ScheduleEventDto(
            e.id,
            e.type,
            e.name,
            e.timeSpan,
            e.detail,
            now,
            e.registeredAt,
            now
          )
        : e
    );
    await this.updateScheduleEvents(updated);
  }

  async markEventsAsEnded(scheduleEventIds: string[]): Promise<void> {
    const events = await this.getScheduleEvents();
    const now = new Date();
    const updated = events.map((e) =>
      scheduleEventIds.includes(e.id)
        ? new ScheduleEventDto(
            e.id,
            e.type,
            e.name,
            e.timeSpan,
            e.detail,
            e.processedAt,
            now,
            now
          )
        : e
    );
    await this.updateScheduleEvents(updated);
  }
}
