import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEventDto } from "./i-schedule-event-dto";
import { ScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable, inject } from "tsyringe";
import { PlayAudioEventConverter } from "./play-audio-event/play-audio-event-converter";
import { ShowContentEventConverter } from "./show-content-event/show-content-event-converter";
import { TransitionPageEventConverter } from "./transition-page-event/transition-page-event-converter";
import { ExecutionStatus } from "../../domains/schedule-event/execution-status";

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

  private deserialize(scheduleEvents: ScheduleEvent[]): IScheduleEventDto {
    const records = new Map<string, string>();
    for (const e of scheduleEvents) {
      records.set(e.settingName, e.settingValue);
    }
    const recordObj = Object.fromEntries(records);
    const type = scheduleEvents[0]?.eventType || recordObj.type;
    if (!type) throw new Error("Type not found in records");
    switch (type) {
      case "PlayAudioEvent":
        return this.playAudioConverter.toEntity(recordObj);
      case "ShowContentEvent":
        return this.showContentConverter.toEntity(recordObj);
      case "TransitionPageEvent":
        return this.transitionPageConverter.toEntity(recordObj);
      default:
        throw new Error(`Unknown event type: ${type}`);
    }
  }

  private serialize(event: IScheduleEventDto): ScheduleEvent[] {
    const records = event.toRecords();
    return Array.from(records.entries()).map(
      ([key, value]) =>
        new ScheduleEvent(event.id, event.type, event.type, key, value)
    );
  }

  async getScheduleEvents(): Promise<IScheduleEventDto[]> {
    const scheduleEvents =
      await this.scheduleEventRepository.getScheduleEvents();
    const grouped = new Map<string, ScheduleEvent[]>();
    for (const e of scheduleEvents) {
      if (!grouped.has(e.id)) grouped.set(e.id, []);
      grouped.get(e.id)!.push(e);
    }
    const events: IScheduleEventDto[] = [];
    for (const group of grouped.values()) {
      events.push(this.deserialize(group));
    }
    return events;
  }

  async updateScheduleEvents(events: IScheduleEventDto[]): Promise<void> {
    const scheduleEvents = events.map((e) => this.serialize(e)).flat();
    await this.scheduleEventRepository.updateScheduleEvents(scheduleEvents);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.scheduleEventRepository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: IScheduleEventDto[]): Promise<string[]> {
    const scheduleEvents = events.map((e) => this.serialize(e)).flat();
    return await this.scheduleEventRepository.addScheduleEvents(scheduleEvents);
  }

  async getCurrentScheduleEvent(): Promise<{
    startEvents: IScheduleEventDto[];
    endEvents: IScheduleEventDto[];
  }> {
    const events = await this.getScheduleEvents();
    const executionStatuses =
      await this.scheduleEventRepository.getAllExecutionStatuses();
    const now = new Date();
    const startEvents: IScheduleEventDto[] = [];
    const endEvents: IScheduleEventDto[] = [];

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
