import { injectable, inject } from "tsyringe";
import { AppEventRepository } from "@model/app-event/app-event-repository";
import type { AppEventData } from "@model/app-event/app-event-data";
import type { ExecutionStatus } from "@model/app-event/execution-status";
import { appEventFromDto, reviveAppEvent, type AppEvent, type AppEventTiming } from "./app-event";
import type { AppEventDto } from "./dto/app-event-dto";

/**
 * 予定イベントの保存・取得・実行状態の管理。
 * 実行する中身(`AppEvent`)の組み立てと実行は `app-event.ts` にある。
 */
@injectable()
export class AppEventService {
  constructor(@inject(AppEventRepository) private repository: AppEventRepository) {}

  async getScheduleEvents(): Promise<AppEvent[]> {
    return this.revive(await this.repository.getScheduleEvents());
  }

  /** 読み込めないイベント(以前の版の種類など)は捨てる。 */
  private revive(raws: readonly AppEventData[]): AppEvent[] {
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

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    await this.repository.deleteScheduleEvents(ids);
  }

  /** 取込の反映: 追加・更新するイベントと、消すイベントの id。 */
  async applyImport(upserts: readonly AppEvent[], deleteIds: readonly string[]): Promise<void> {
    await this.repository.applyImport(upserts, deleteIds);
  }

  /** サーバーの最新を、この端末のキャッシュに写す(再生端末の定期取得。サーバーには書かない)。 */
  async refresh(): Promise<void> {
    await this.repository.refresh();
  }

  async getCurrentScheduleEvent(): Promise<{
    startEvents: AppEvent[];
    endEvents: AppEvent[];
  }> {
    const snapshot = await this.repository.getSnapshot();
    const events = this.revive(snapshot.events);
    const executionStatuses = snapshot.status;
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

  /** 実行を始めたイベントを「実行中」にする(サーバーの操作。編集とは別に適用される)。 */
  async markEventsAsStarted(scheduleEventIds: string[]): Promise<void> {
    await this.repository.markScheduleEvents(scheduleEventIds, "running");
  }

  /** 実行を終えたイベントを「完了」にする。 */
  async markEventsAsEnded(scheduleEventIds: string[]): Promise<void> {
    await this.repository.markScheduleEvents(scheduleEventIds, "completed");
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
      id: existing?.id ?? crypto.randomUUID(),
      startTime: input.startTime,
      endTime: input.endTime,
      processedAt: existing?.processedAt ?? null,
      registeredAt: existing?.registeredAt ?? now,
      updatedAt: now,
    };
    const { startTime: _s, endTime: _e, ...dto } = input;
    await this.repository.saveScheduleEvent(appEventFromDto(dto, timing));
  }
}
