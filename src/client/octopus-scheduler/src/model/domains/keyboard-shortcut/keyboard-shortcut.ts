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
    if (this.eventIds && this.eventIds.length > 0) {
      try {
        const appEventService = container.resolve(AppEventService);
        console.debug(
          "[KeyboardShortcut] Executing events for shortcut",
          this.id,
          this.eventIds
        );
        for (const id of this.eventIds) {
          try {
            console.debug(
              `[KeyboardShortcut] dispatch start eventId=${id} ts=${Date.now()}`
            );
            const ev = await appEventService.getEventById(id);
            console.debug(
              `[KeyboardShortcut] dispatch resolved eventId=${id} found=${!!ev} ts=${Date.now()}`
            );
            if (!ev) continue;
            console.debug(
              `[KeyboardShortcut] invoking execute eventId=${id} type=${(ev as any).type ?? "unknown"} ts=${Date.now()}`
            );
            const p = ev.execute(true, true);
            if (p && typeof (p as any).catch === "function") {
              (p as Promise<any>).catch((err) => {
                console.error(
                  `[KeyboardShortcut] execute promise rejected eventId=${id} err=`,
                  err
                );
              });
            }
            console.debug(
              `[KeyboardShortcut] invoke returned eventId=${id} ts=${Date.now()}`
            );
          } catch (err) {
            console.error(
              `[KeyboardShortcut] failed to execute eventId=${id} err=`,
              err
            );
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
