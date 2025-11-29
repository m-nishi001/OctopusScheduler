import type { IAppEventRepository } from "../../domains/app-event/app-event-repository";
import { IAppEventRepositoryToken } from "../../domains/app-event/app-event-repository";
import type { IAppEvent } from "../../domains/app-event/app-event";
import { injectable, injectAll, inject, container } from "tsyringe";
import { UIActionEntryToken } from "../../../core/container";
import type { IAppEventDto } from "./i-app-event-dto";
import type { ExecutionStatus } from "model/domains/app-event/execution-status";
import { IEventSerializerToken } from "../../domains/app-event/i-event-serializer";
import type { IEventSerializer } from "../../domains/app-event/i-event-serializer";

@injectable()
export class AppEventService {
  private readonly serializers: IEventSerializer[];

  constructor(
    @inject(IAppEventRepositoryToken)
    private scheduleEventRepository: IAppEventRepository,
    @injectAll(IEventSerializerToken) serializers: IEventSerializer[]
  ) {
    this.serializers = serializers;
  }

  async getScheduleEvents(): Promise<IAppEvent[]> {
    const raws = await this.scheduleEventRepository.getScheduleEvents();
    const results: IAppEvent[] = [];
    for (const raw of raws) {
      try {
        const serializer = this.serializers.find((s) => s.canRevive(raw));
        if (!serializer) continue;
        const ev = serializer.revive(raw);
        if (ev) results.push(ev);
      } catch (e) {
        console.error("Failed to revive schedule event", e);
      }
    }
    return results;
  }

  /**
   * Get a single schedule event by id. Returns null if not found.
   */
  async getEventById(id: string): Promise<IAppEvent | null> {
    if (!id) return null;
    console.debug("[AppEventService] getEventById", id);
    try {
      const raw = await this.scheduleEventRepository.getEventById(String(id));
      console.debug("[AppEventService] getEventById result", {
        id,
        found: !!raw,
      });

      if (!raw) return null;

      // If the returned object already has executable behavior, return as-is
      if (typeof (raw as IAppEvent).execute === "function") {
        console.debug("[AppEventService] getEventById: already an instance", {
          id,
        });
        return raw as IAppEvent;
      }

      // Attempt to revive the raw object into a domain instance using registered serializers
      const serializer = this.serializers.find((s) => {
        try {
          return s.canRevive(raw as IAppEvent);
        } catch {
          return false;
        }
      });

      if (serializer) {
        try {
          const ev = serializer.revive(raw as IAppEvent);
          if (ev) {
            console.debug("[AppEventService] getEventById: revived instance", {
              id,
            });
            return ev;
          }
        } catch (e) {
          console.error("[AppEventService] revive failed", e);
        }
      }

      // Could not revive to an executable instance
      console.warn(
        "[AppEventService] getEventById: no serializer could revive the raw event",
        { id }
      );
      return null;
    } catch (e) {
      console.error("getEventById failed", e);
      return null;
    }
  }

  /**
   * Return an initial DTO for the given event type.
   * This returns default initialization data based solely on `eventType`.
   * Lookup order:
   *  - UI action registry `defaultData` if available (called with empty object)
   *  - fallback to minimal DTO `{ actionType }`
   */
  getDefault(eventType: string): IAppEventDto {
    // Use UI registry defaultData if available; do not attempt to convert domain entities here.
    try {
      const entries = container.resolveAll<any>(
        UIActionEntryToken as any
      ) as any[];
      const entry = entries.find((e) => e && e.actionType === eventType);
      if (entry && typeof entry.defaultData === "function") {
        return entry.defaultData({});
      }
    } catch (e) {
      // ignore
    }

    return { actionType: eventType } as IAppEventDto;
  }

  async updateScheduleEvents(events: IAppEvent[]): Promise<void> {
    await this.scheduleEventRepository.updateScheduleEvents(events);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.scheduleEventRepository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: IAppEvent[]): Promise<string> {
    const id = await this.scheduleEventRepository.addScheduleEvents(events);
    return id;
  }

  async getCurrentScheduleEvent(): Promise<{
    startEvents: IAppEvent[];
    endEvents: IAppEvent[];
  }> {
    const events = await this.getScheduleEvents();
    const executionStatuses =
      await this.scheduleEventRepository.getAllExecutionStatuses();
    const now = new Date();
    const startEvents: IAppEvent[] = [];
    const endEvents: IAppEvent[] = [];

    for (const event of events) {
      const status =
        (executionStatuses[event.id] as ExecutionStatus) || "pending";

      if (
        status === "pending" &&
        event.startTime <= now &&
        now < event.endTime
      ) {
        startEvents.push(event);
      } else if (status === "running" && event.endTime <= now) {
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
      await this.scheduleEventRepository.updateExecutionStatus(id, "running");
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
      await this.scheduleEventRepository.updateExecutionStatus(id, "completed");
    }
  }

  async syncScheduleEvents(mode: "local" | "gas" = "local"): Promise<void> {
    await this.scheduleEventRepository.syncScheduleEvents(mode);
  }
}
