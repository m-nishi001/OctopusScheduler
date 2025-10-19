import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable, injectAll } from "tsyringe";
import {
  IScheduleEventConverterToken,
  type IScheduleEventConverter,
} from "../../domains/schedule-event/i-schedule-event-converter";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
  private readonly localStorage: LocalStorageService;
  private readonly executionStatusStorage: LocalStorageService;
  private readonly converters: IScheduleEventConverter[];

  constructor(
    @injectAll(IScheduleEventConverterToken)
    converters: IScheduleEventConverter[]
  ) {
    this.localStorage = new LocalStorageService(
      "octopus-scheduler",
      "ScheduleEventData"
    );
    this.executionStatusStorage = new LocalStorageService(
      "octopus-scheduler",
      "ScheduleEventExecutionStatus"
    );
    this.converters = converters;
  }

  async getScheduleEvents(): Promise<IScheduleEvent[]> {
    const all = await this.localStorage.getAll<IScheduleEvent>();
    const results: IScheduleEvent[] = [];
    for (const [, raw] of all.entries()) {
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
    for (const event of events) {
      await this.localStorage.save(event.id, event);
    }
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.localStorage.removeMultiple(ids);
  }

  async addScheduleEvents(events: IScheduleEvent[]): Promise<string> {
    const id = crypto.randomUUID();
    const promises: Promise<void>[] = [];
    for (const ev of events) {
      const newEv = { ...ev, id };
      promises.push(this.localStorage.save(id, newEv));
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
}
