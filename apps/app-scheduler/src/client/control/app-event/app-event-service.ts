import { injectable, inject } from "tsyringe";
import { AppEventRepository } from "@model/app-event/app-event-repository";
import type { ExecutionStatus } from "@model/app-event/execution-status";
import { AssetService } from "../asset/asset-service";
import { appEventFromDto, reviveAppEvent, type AppEvent, type AppEventTiming } from "./app-event";
import type { AppEventDto } from "./dto/app-event-dto";

@injectable()
export class AppEventService {
  constructor(
    @inject(AppEventRepository) private repository: AppEventRepository,
    @inject(AssetService) private assetService: AssetService
  ) {}

  async getScheduleEvents(): Promise<AppEvent[]> {
    const raws = await this.repository.getScheduleEvents();
    const results: AppEvent[] = [];
    for (const raw of raws) {
      try {
        results.push(reviveAppEvent(raw));
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
      return reviveAppEvent(raw);
    } catch (e) {
      console.error("getEventById failed", e);
      return null;
    }
  }

  /**
   * Return a minimal DTO for the given event type. Control has no knowledge
   * of UI-only form defaults (`ui/pages/settings/app-events/registry`); the
   * caller merges those in when a richer default is wanted.
   */
  getDefault(eventType: string): AppEventDto {
    return { actionType: eventType } as AppEventDto;
  }

  async updateScheduleEvents(events: AppEvent[]): Promise<void> {
    await this.repository.updateScheduleEvents(events);
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.repository.deleteScheduleEvents(ids);
  }

  async addScheduleEvents(events: AppEvent[]): Promise<string[]> {
    return await this.repository.addScheduleEvents(events);
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

  /**
   * 予定のイベントを保存する。編集のときは `existing` の id・処理済み日時・登録日時を引き継ぐ。
   */
  async saveScheduledEvent(
    input: AppEventDto & { startTime: Date; endTime: Date },
    existing?: AppEvent
  ): Promise<void> {
    const now = new Date();
    const timing: AppEventTiming = {
      id: existing?.id ?? "",
      startTime: input.startTime,
      endTime: input.endTime,
      processedAt: existing?.processedAt ?? null,
      registeredAt: existing?.registeredAt ?? now,
      updatedAt: now,
    };
    const { startTime: _s, endTime: _e, ...dto } = input;
    const ev = appEventFromDto(dto, timing);
    if (existing) {
      await this.updateScheduleEvents([ev]);
    } else {
      await this.addScheduleEvents([ev]);
    }
  }

  // Uploads any queued files for a ShowContentEvent's html body / contentId,
  // rewriting `{{asset:image|video:<tempId>}}` placeholders to the resulting
  // real asset ids. Replaces the old ContentDisplayEventRegister class.
  async resolveShowContentUploads(
    currentContentId: string | undefined,
    currentHtml: string | undefined,
    uploadFiles: Array<{ tempId: string; file: File }> | undefined
  ): Promise<{ contentId: string; htmlString: string }> {
    const queued = uploadFiles || [];
    if (!queued.length) {
      return { contentId: currentContentId ?? "", htmlString: currentHtml ?? "" };
    }

    const tempOrder: string[] = [];
    const assetsToAdd: Array<Record<string, unknown>> = [];
    for (const entry of queued) {
      tempOrder.push(entry.tempId);
      const f = entry.file;
      assetsToAdd.push({
        id: "",
        name: f.name,
        uploadedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        size: f.size,
        blob: f,
      });
    }
    if (!assetsToAdd.length) {
      return { contentId: currentContentId ?? "", htmlString: currentHtml ?? "" };
    }

    const ids = await this.assetService.addAssets(assetsToAdd as any);
    const tempToReal: Record<string, string> = {};
    for (let i = 0; i < tempOrder.length; i++) tempToReal[tempOrder[i]] = ids[i];

    let html = currentHtml ?? "";
    for (const tempId of tempOrder) {
      const realId = tempToReal[tempId];
      const regex = new RegExp(`\\{\\{asset:(image|video):${tempId}\\}\\}`, "g");
      html = html.replace(regex, (_match: string, type: string) => `{{asset:${type}:${realId}}}`);
    }

    let newContentId = currentContentId ?? "";
    if (currentContentId && tempToReal[currentContentId]) {
      newContentId = tempToReal[currentContentId];
    }

    return { contentId: newContentId, htmlString: html };
  }
}
