// NOTE: events are referenced by id now; domain no longer depends on event instances
import { container } from "tsyringe";
import { AppEventService } from "../../applications/app-event/app-event-service";
// NOTE: event bus is not required here since we use polymorphic execute

export interface KeyboardShortcutData {
  id: string;
  keys: string[];
  // backward-compatible: either provide serialized actions or eventIds
  actions?: Array<{
    type: string;
    [key: string]: any;
  }>;
  eventIds?: string[];
}

export class KeyboardShortcut {
  readonly id: string;
  readonly keys: string[]; // 例: ["Control", "1"] （押下順）
  // canonical: reference events by id
  readonly eventIds: string[];

  constructor(params: { id: string; keys: string[]; eventIds?: string[] }) {
    this.id = params.id;
    this.keys = params.keys;
    this.eventIds = params.eventIds || [];
  }

  // キーボードトリガーで実行
  async execute(): Promise<void> {
    // Option A semantics: start each action in order but do not await
    // completion of each action (fire-and-forget ordering). This lets
    // actions such as audio playback and content show start nearly
    // simultaneously while preserving start order.
    // Resolve events by id via AppEventService and execute them.
    if (this.eventIds && this.eventIds.length > 0) {
      try {
        const appEventService = container.resolve(AppEventService);
        for (const id of this.eventIds) {
          try {
            const ev = await appEventService.getEventById(id);
            if (!ev) continue;
            const p = ev.execute(true, true);
            if (p && typeof (p as any).catch === "function") {
              (p as Promise<any>).catch(() => {});
            }
          } catch (_) {
            // ignore individual event execution errors
          }
        }
      } catch (e) {
        // if AppEventService not available, swallow to avoid crashes
      }
    }
  }

  // シリアライズ（保存用）
  serialize(): KeyboardShortcutData {
    const data: KeyboardShortcutData = { id: this.id, keys: this.keys };
    if (this.eventIds && this.eventIds.length > 0) {
      data.eventIds = this.eventIds.slice();
    }
    return data;
  }

  // デシリアライズ（復元用）
  static fromData(data: KeyboardShortcutData): KeyboardShortcut {
    const { id, keys } = data;
    // New format: eventIds
    const eventIds = data.eventIds || [];
    return new KeyboardShortcut({ id, keys, eventIds });
  }

  // デシリアライズ（復元用） - サービス層で実装
  static revive(_raw: string[]): KeyboardShortcut | null {
    return null;
  }
}
