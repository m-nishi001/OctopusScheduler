import { injectable, inject, container } from "tsyringe";
import { AppEventRepository } from "@model/app-event/app-event-repository";
import type { AppEventData } from "@model/app-event/app-event-data";
import type { ExecutionStatus } from "@model/app-event/execution-status";
import { UIActionEntryToken } from "../../domains/app-event/ui-action-entry-token";
import type { AppEvent } from "./app-event";
import type { AppEventDto } from "./dto/app-event-dto";
import { PlayAudioEvent } from "./play-audio/play-audio-event";
import { ShowContentEvent } from "./show-content/show-content-event";
import { SlideshowEvent } from "./slideshow/slideshow-event";
import { StopAudioEvent } from "./stop-audio/stop-audio-event";
import { TransitionPageEvent } from "./transition/transition-page-event";

// The concrete union of every event kind. `AppEventService` is the only
// place that ever constructs these, so it is also the only place that needs
// to know the full union (everywhere else works with the plain `AppEvent`
// behavioral contract).
export type AnyAppEvent =
  | PlayAudioEvent
  | ShowContentEvent
  | SlideshowEvent
  | StopAudioEvent
  | TransitionPageEvent;

function assertNever(x: never): never {
  throw new Error(`Unhandled app-event value: ${JSON.stringify(x)}`);
}

@injectable()
export class AppEventService {
  constructor(
    @inject(AppEventRepository) private repository: AppEventRepository
  ) {}

  // The single place plain storage data is turned into a behavioral event
  // instance. Replaces the old *-event-serializer.ts files + IEventSerializerToken.
  private reviveEvent(raw: AppEventData): AnyAppEvent {
    switch (raw.type) {
      case "PlayAudioEvent":
        return PlayAudioEvent.fromRawData(raw);
      case "ShowContentEvent":
        return ShowContentEvent.fromRawData(raw);
      case "SlideshowEvent":
        return SlideshowEvent.fromRawData(raw);
      case "StopAudioEvent":
        return StopAudioEvent.fromRawData(raw);
      case "TransitionPageEvent":
        return TransitionPageEvent.fromRawData(raw);
      default:
        return assertNever(raw);
    }
  }

  // Replaces the old *-event-converter.ts files' `toEntity()` + IAppEventConverterToken.
  buildEventFromDto(dto: AppEventDto): AnyAppEvent {
    switch (dto.actionType) {
      case "PlayAudioEvent":
        return PlayAudioEvent.fromData(dto);
      case "ShowContentEvent":
        return ShowContentEvent.fromData(dto);
      case "SlideshowEvent":
        return SlideshowEvent.fromData(dto);
      case "StopAudioEvent":
        return StopAudioEvent.fromData(dto);
      case "TransitionPageEvent":
        return TransitionPageEvent.fromData(dto);
      default:
        return assertNever(dto);
    }
  }

  // Replaces the old *-event-converter.ts files' `toDto()`.
  toDto(event: AppEvent): AppEventDto {
    // AppEventService is the only place that constructs AppEvent instances,
    // so any value reaching here is known to be one of the concrete classes
    // even though the public contract only guarantees the AppEvent shape.
    const ev = event as AnyAppEvent;
    switch (ev.type) {
      case "PlayAudioEvent":
        return {
          actionType: "PlayAudioEvent",
          id: ev.id,
          audioId: ev.audioId,
          fadeOutDuration: ev.fadeOutDuration,
        };
      case "ShowContentEvent":
        return {
          actionType: "ShowContentEvent",
          id: ev.id,
          contentType: ev.contentType,
          contentId: ev.contentId,
          htmlString: ev.htmlString,
          fadeOutDuration: ev.fadeOutDuration,
          displayMode: ev.displayMode,
          effect: ev.effect,
          duration: ev.duration,
          fadeInTime: ev.fadeInTime,
          fadeOutTime: ev.fadeOutTime,
          scrollDirection: ev.scrollDirection,
        };
      case "SlideshowEvent":
        return {
          actionType: "SlideshowEvent",
          id: ev.id,
          folderId: ev.folderId,
          displayDuration: ev.displayDuration,
          transitionType: ev.transitionType,
          slideDirection: ev.slideDirection,
          bgmIds: ev.bgmIds,
        };
      case "StopAudioEvent":
        return {
          actionType: "StopAudioEvent",
          id: ev.id,
          audioId: ev.audioId,
          fadeOutDuration: ev.fadeOutDuration,
        };
      case "TransitionPageEvent":
        return {
          actionType: "TransitionPageEvent",
          id: ev.id,
          transitionUrl: ev.transitionUrl,
          fadeOutDuration: ev.fadeOutDuration,
        };
      default:
        return assertNever(ev);
    }
  }

  async getScheduleEvents(): Promise<AppEvent[]> {
    const raws = await this.repository.getScheduleEvents();
    const results: AppEvent[] = [];
    for (const raw of raws) {
      try {
        results.push(this.reviveEvent(raw));
      } catch (e) {
        console.error("Failed to revive schedule event", e);
      }
    }
    return results;
  }

  /**
   * Get a single schedule event by id. Returns null if not found.
   */
  async getEventById(id: string): Promise<AppEvent | null> {
    if (!id) return null;
    try {
      const raw = await this.repository.getEventById(String(id));
      if (!raw) return null;
      return this.reviveEvent(raw);
    } catch (e) {
      console.error("getEventById failed", e);
      return null;
    }
  }

  /**
   * Return an initial DTO for the given event type, sourced from the UI
   * action registry's `defaultData` when available.
   */
  getDefault(eventType: string): AppEventDto {
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

    return { actionType: eventType } as AppEventDto;
  }

  async updateScheduleEvents(events: AppEvent[]): Promise<void> {
    // AppEvent instances are structurally a superset of AppEventData (they
    // add execute()/serializeAsObject()), so this is a safe widening, not a lie.
    await this.repository.updateScheduleEvents(
      events as unknown as AppEventData[]
    );
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.repository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: AppEvent[]): Promise<string[]> {
    return await this.repository.addScheduleEvents(
      events as unknown as AppEventData[]
    );
  }

  async getCurrentScheduleEvent(): Promise<{
    startEvents: AppEvent[];
    endEvents: AppEvent[];
  }> {
    const events = await this.getScheduleEvents();
    const executionStatuses = await this.repository.getAllExecutionStatuses();
    const now = new Date();
    const startEvents: AppEvent[] = [];
    const endEvents: AppEvent[] = [];

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
    const raws = await this.repository.getScheduleEvents();
    const now = new Date();
    const updated = raws.map((raw) =>
      scheduleEventIds.includes(raw.id)
        ? { ...raw, processedAt: now, updatedAt: now }
        : raw
    );
    await this.repository.updateScheduleEvents(updated);
    for (const id of scheduleEventIds) {
      await this.repository.updateExecutionStatus(id, "running");
    }
  }

  async markEventsAsEnded(scheduleEventIds: string[]): Promise<void> {
    const raws = await this.repository.getScheduleEvents();
    const now = new Date();
    const updated = raws.map((raw) =>
      scheduleEventIds.includes(raw.id)
        ? { ...raw, registeredAt: now, updatedAt: now }
        : raw
    );
    await this.repository.updateScheduleEvents(updated);
    for (const id of scheduleEventIds) {
      await this.repository.updateExecutionStatus(id, "completed");
    }
  }
}
