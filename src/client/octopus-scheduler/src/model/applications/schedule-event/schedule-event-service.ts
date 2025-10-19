import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable, injectAll, inject } from "tsyringe";
import { ExecutionStatus } from "../../domains/schedule-event/execution-status";
import {
  IScheduleEventConverterToken,
  type IScheduleEventConverter,
} from "../../domains/schedule-event/i-schedule-event-converter";

@injectable()
export class ScheduleEventService {
  private readonly converters: IScheduleEventConverter[];

  constructor(
    @inject("IScheduleEventRepository")
    private scheduleEventRepository: IScheduleEventRepository,
    @injectAll(IScheduleEventConverterToken)
    converters: IScheduleEventConverter[]
  ) {
    this.converters = converters;
  }

  async getScheduleEvents(): Promise<IScheduleEvent[]> {
    const raws = await this.scheduleEventRepository.getScheduleEvents();
    const results: IScheduleEvent[] = [];
    for (const raw of raws) {
      try {
        const converter = this.converters.find((c) => c.canRevive(raw))!;
        const ev = converter.revive(raw);
        if (ev) results.push(ev);
      } catch (e) {
        console.error("Failed to revive schedule event", e);
      }
    }
    return results;
  }

  async updateScheduleEvents(events: IScheduleEvent[]): Promise<void> {
    await this.scheduleEventRepository.updateScheduleEvents(events);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
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
