import type { IAppEventRepository } from "../../domains/app-event/app-event-repository";
import { IAppEventRepositoryToken } from "../../domains/app-event/app-event-repository";
import type { IAppEvent } from "../../domains/app-event/app-event";
import { injectable, injectAll, inject } from "tsyringe";
import { resolve as resolveEventConverter } from "../../../core/event-converter/event-converter-resolver";
import { getUIActionRegistry } from "../../../ui/components/settings/keyboard-shortcut/action-registry";
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
   * Return an initial DTO for the given event type.
   * If an existing action object is provided, prefer converter.toDto(action).
   * Lookup order:
   *  - converter.toDto(action) if available
   *  - UI action registry `defaultData` if available
   *  - fallback to minimal DTO `{ actionType }`
   */
  getDefault(eventType: string, action?: any): IAppEventDto {
    // Prefer converter.toDto for existing domain entities passed in as `action`.
    try {
      const conv = resolveEventConverter(eventType);
      if (conv && action && typeof (conv as any).toDto === "function") {
        try {
          return (conv as any).toDto(action) as IAppEventDto;
        } catch (e) {
          // if conversion fails, fall through to registry/default
        }
      }
    } catch (e) {
      // ignore
    }

    // Next, use UI registry defaultData if available
    try {
      const ACTION_REGISTRY = getUIActionRegistry();
      const entry = ACTION_REGISTRY[eventType];
      if (entry && typeof (entry as any).defaultData === "function") {
        return (entry as any).defaultData(action ?? {}) as IAppEventDto;
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
