import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEventEntity } from "../../domains/schedule-event/i-schedule-event-entity";
import { injectable, inject } from "tsyringe";

@injectable()
export class ScheduleEventService {
  constructor(
    @inject("IScheduleEventRepository")
    private scheduleEventRepository: IScheduleEventRepository
  ) {}

  async getScheduleEvents(): Promise<IScheduleEventEntity[]> {
    return await this.scheduleEventRepository.getScheduleEvents();
  }

  async updateScheduleEvents(events: IScheduleEventEntity[]): Promise<void> {
    await this.scheduleEventRepository.updateScheduleEvents(events);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.scheduleEventRepository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: IScheduleEventEntity[]): Promise<string[]> {
    return await this.scheduleEventRepository.addScheduleEvents(events);
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
