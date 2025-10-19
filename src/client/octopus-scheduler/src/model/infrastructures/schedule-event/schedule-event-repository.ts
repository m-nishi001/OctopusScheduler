import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { ShowContentEvent } from "../../domains/schedule-event/show-content-event";
import { PlayAudioEvent } from "../../domains/schedule-event/play-audio-event";
import { SlideshowEvent } from "../../domains/schedule-event/slideshow-event";
import { injectable } from "tsyringe";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
  private readonly localStorage: LocalStorageService;
  private readonly executionStatusStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService(
      "octopus-scheduler",
      "ScheduleEventData"
    );
    this.executionStatusStorage = new LocalStorageService(
      "octopus-scheduler",
      "ScheduleEventExecutionStatus"
    );
  }

  // Store one IScheduleEvent per key (key is event.id). Dates are saved as ISO strings.
  async getScheduleEvents(): Promise<IScheduleEvent[]> {
    const all = await this.localStorage.getAll<any>();
    const results: IScheduleEvent[] = [];
    for (const [, raw] of all.entries()) {
      try {
        const ev = this.reviveEvent(raw);
        if (ev) results.push(ev);
      } catch (e) {
        console.error("Failed to revive schedule event", e);
      }
    }
    return results;
  }

  async updateScheduleEvents(events: IScheduleEvent[]): Promise<void> {
    for (const event of events) {
      const stored = this.prepareForStorage(event);
      await this.localStorage.save(event.id, stored);
    }
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    // keys are stored by event id
    if (ids.length === 0) return;
    await this.localStorage.removeMultiple(ids);
  }

  async addScheduleEvents(events: IScheduleEvent[]): Promise<string> {
    const id = crypto.randomUUID();
    const promises: Promise<void>[] = [];
    for (const ev of events) {
      // clone and set id
      const newEv = { ...(ev as any), id };
      const stored = this.prepareForStorage(newEv as IScheduleEvent);
      promises.push(this.localStorage.save(id, stored));
    }
    await Promise.all(promises);
    return id;
  }

  async syncScheduleEvents(): Promise<void> {
    console.info("syncScheduleEvents: not implemented (GAS calls removed)");
    return Promise.resolve();
  }

  async getExecutionStatus(eventId: string): Promise<string | null> {
    const status = await this.executionStatusStorage.get<string>(eventId);
    return status || null;
  }

  async updateExecutionStatus(eventId: string, status: string): Promise<void> {
    await this.executionStatusStorage.save(eventId, status);
  }

  async getAllExecutionStatuses(): Promise<{ [eventId: string]: string }> {
    const allStatuses = await this.executionStatusStorage.getAll<string>();
    const result: { [eventId: string]: string } = {};
    for (const [k, v] of allStatuses.entries()) {
      result[k] = v;
    }
    return result;
  }

  async markEventAsStarted(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, "running");
  }

  async markEventAsCompleted(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, "completed");
  }

  async markEventAsFailed(eventId: string): Promise<void> {
    await this.updateExecutionStatus(eventId, "completed");
  }

  private prepareForStorage(event: IScheduleEvent): any {
    const obj: any = { ...event };
    // convert Date fields to ISO strings
    if (obj.startTime instanceof Date)
      obj.startTime = obj.startTime.toISOString();
    if (obj.endTime instanceof Date) obj.endTime = obj.endTime.toISOString();
    if (obj.processedAt instanceof Date)
      obj.processedAt = obj.processedAt.toISOString();
    if (obj.registeredAt instanceof Date)
      obj.registeredAt = obj.registeredAt.toISOString();
    if (obj.updatedAt instanceof Date)
      obj.updatedAt = obj.updatedAt.toISOString();
    return obj;
  }

  private reviveEvent(raw: any): IScheduleEvent | null {
    if (!raw || !raw.type) return null;
    const base = { ...(raw as any) };
    // parse date strings back to Date
    if (typeof base.startTime === "string")
      base.startTime = new Date(base.startTime);
    if (typeof base.endTime === "string") base.endTime = new Date(base.endTime);
    if (typeof base.processedAt === "string")
      base.processedAt = new Date(base.processedAt);
    else if (base.processedAt === "") base.processedAt = null;
    if (typeof base.registeredAt === "string")
      base.registeredAt = new Date(base.registeredAt);
    if (typeof base.updatedAt === "string")
      base.updatedAt = new Date(base.updatedAt);

    switch (base.type) {
      case "ShowContentEvent":
        return new ShowContentEvent(base);
      case "PlayAudioEvent":
        return new PlayAudioEvent(base);
      case "SlideshowEvent":
        return new SlideshowEvent(base);
      default:
        console.warn("Unknown schedule event type in storage:", base.type);
        return base as IScheduleEvent;
    }
  }
}
