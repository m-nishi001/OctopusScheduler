import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable, inject } from "tsyringe";
import { ExecutionStatus } from "../../domains/schedule-event/execution-status";

@injectable()
export class ScheduleEventService {
  constructor(
    @inject("IScheduleEventRepository")
    private scheduleEventRepository: IScheduleEventRepository
    // converters removed; domain entities handle serialization
  ) {}

  async getScheduleEvents(): Promise<IScheduleEvent[]> {
    return await this.scheduleEventRepository.getScheduleEvents();
  }

  async updateScheduleEvents(events: IScheduleEvent[]): Promise<void> {
    await this.scheduleEventRepository.updateScheduleEvents(events);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    // previously cleaned up asset refs; no longer needed
    await this.scheduleEventRepository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: IScheduleEvent[]): Promise<string> {
    const id = await this.scheduleEventRepository.addScheduleEvents(events);
    return id;
  }

  async getCurrentScheduleEvent(): Promise<{
    startEvents: IScheduleEvent[];
    endEvents: IScheduleEvent[];
  }> {
    const events = await this.getScheduleEvents();
    const executionStatuses =
      await this.scheduleEventRepository.getAllExecutionStatuses();
    const now = new Date();
    const startEvents: IScheduleEvent[] = [];
    const endEvents: IScheduleEvent[] = [];

    for (const event of events) {
      const status =
        (executionStatuses[event.id] as ExecutionStatus) ||
        ExecutionStatus.Pending;

      if (
        status === ExecutionStatus.Pending &&
        event.startTime <= now &&
        now < event.endTime
      ) {
        startEvents.push(event);
      } else if (status === ExecutionStatus.Running && event.endTime <= now) {
        endEvents.push(event);
      }
    }

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
    // Update execution statuses
    for (const id of scheduleEventIds) {
      await this.scheduleEventRepository.updateExecutionStatus(
        id,
        ExecutionStatus.Running
      );
    }
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
    // Update execution statuses
    for (const id of scheduleEventIds) {
      await this.scheduleEventRepository.updateExecutionStatus(
        id,
        ExecutionStatus.Completed
      );
    }
  }

  async syncScheduleEvents(): Promise<void> {
    await this.scheduleEventRepository.syncScheduleEvents();
  }
}
