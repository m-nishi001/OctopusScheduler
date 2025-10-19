import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { ScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { ShowContentEvent } from "../../domains/schedule-event/show-content-event";
import { PlayAudioEvent } from "../../domains/schedule-event/play-audio-event";
import { SlideshowEvent } from "../../domains/schedule-event/slideshow-event";
import { injectable, inject } from "tsyringe";
import { ExecutionStatus } from "../../domains/schedule-event/execution-status";

@injectable()
export class ScheduleEventService {
  constructor(
    @inject("IScheduleEventRepository")
    private scheduleEventRepository: IScheduleEventRepository
    // converters removed; domain entities handle serialization
  ) {}
  private deserialize(scheduleEvents: ScheduleEvent[]): IScheduleEvent {
    const scheduleEventType = scheduleEvents[0].type;
    const records = new Map<string, string>();
    for (const e of scheduleEvents) {
      records.set(e.settingName, e.settingValue);
    }
    const r = Object.fromEntries(records);
    switch (scheduleEventType) {
      case "ShowContentEvent":
        return new ShowContentEvent({
          id: r.id,
          startTime: new Date(r.startTime),
          endTime: new Date(r.endTime),
          contentType: r.contentType as any,
          contentId: r.contentId || undefined,
          htmlString: r.htmlString || undefined,
          fadeOutDuration: r.fadeOutDuration
            ? parseFloat(r.fadeOutDuration)
            : undefined,
          displayMode: (r.displayMode as any) || undefined,
          effect: (r.effect as any) || undefined,
          duration: r.duration ? parseFloat(r.duration) : undefined,
          fadeInTime: r.fadeInTime ? parseFloat(r.fadeInTime) : undefined,
          fadeOutTime: r.fadeOutTime ? parseFloat(r.fadeOutTime) : undefined,
          scrollDirection: (r.scrollDirection as any) || undefined,
          processedAt: r.processedAt ? new Date(r.processedAt) : null,
          registeredAt: new Date(r.registeredAt),
          updatedAt: new Date(r.updatedAt),
        });
      case "PlayAudioEvent":
        return new PlayAudioEvent({
          id: r.id,
          startTime: new Date(r.startTime),
          endTime: new Date(r.endTime),
          audioId: r.audioId,
          fadeOutDuration: r.fadeOutDuration
            ? parseFloat(r.fadeOutDuration)
            : undefined,
          processedAt: r.processedAt ? new Date(r.processedAt) : null,
          registeredAt: new Date(r.registeredAt),
          updatedAt: new Date(r.updatedAt),
        });
      case "SlideshowEvent":
        return new SlideshowEvent({
          id: r.id,
          startTime: new Date(r.startTime),
          endTime: new Date(r.endTime),
          folderId: r.folderId,
          displayDuration: parseFloat(r.displayDuration || "0"),
          transitionType: r.transitionType as any,
          slideDirection: (r.slideDirection as any) || undefined,
          bgmIds: r.bgmIds ? r.bgmIds.split(",") : [],
          processedAt: r.processedAt ? new Date(r.processedAt) : null,
          registeredAt: new Date(r.registeredAt),
          updatedAt: new Date(r.updatedAt),
        });
      default:
        throw new Error(`Unknown event type: ${scheduleEventType}`);
    }
  }

  private serialize(event: IScheduleEvent): ScheduleEvent[] {
    const values = event.serialize();
    const keysMap: { [k: string]: string[] } = {
      ShowContentEvent: [
        "startTime",
        "endTime",
        "contentType",
        "contentId",
        "htmlString",
        "fadeOutDuration",
        "displayMode",
        "effect",
        "duration",
        "fadeInTime",
        "fadeOutTime",
        "scrollDirection",
        "processedAt",
        "registeredAt",
        "updatedAt",
      ],
      PlayAudioEvent: [
        "startTime",
        "endTime",
        "audioId",
        "fadeOutDuration",
        "processedAt",
        "registeredAt",
        "updatedAt",
      ],
      SlideshowEvent: [
        "startTime",
        "endTime",
        "folderId",
        "displayDuration",
        "transitionType",
        "slideDirection",
        "bgmIds",
        "processedAt",
        "registeredAt",
        "updatedAt",
      ],
    } as const;
    const keys = (keysMap as any)[event.type];
    return values.map(
      (v, i) => new ScheduleEvent(event.id, event.type, keys[i], v)
    );
  }

  async getScheduleEvents(): Promise<IScheduleEvent[]> {
    const scheduleEvents =
      await this.scheduleEventRepository.getScheduleEvents();
    const grouped = new Map<string, ScheduleEvent[]>();
    for (const e of scheduleEvents) {
      if (!grouped.has(e.id)) grouped.set(e.id, []);
      grouped.get(e.id)!.push(e);
    }
    const events: IScheduleEvent[] = [];
    for (const group of grouped.values()) {
      events.push(this.deserialize(group));
    }
    return events;
  }

  async updateScheduleEvents(events: IScheduleEvent[]): Promise<void> {
    const scheduleEvents = events.map((e) => this.serialize(e)).flat();
    await this.scheduleEventRepository.updateScheduleEvents(scheduleEvents);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    // previously cleaned up asset refs; no longer needed
    await this.scheduleEventRepository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: IScheduleEvent[]): Promise<string> {
    const scheduleEvents = events.map((e) => this.serialize(e)).flat();
    const id =
      await this.scheduleEventRepository.addScheduleEvents(scheduleEvents);
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
