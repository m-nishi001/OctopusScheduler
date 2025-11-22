import type { IAppEvent } from "../app-event/app-event";
import { getEventFromData } from "../app-event/event-registry";
// NOTE: event bus is not required here since we use polymorphic execute

export interface KeyboardShortcutData {
  id: string;
  keys: string[];
  actions: Array<{
    type: string;
    [key: string]: any;
  }>;
}

export class KeyboardShortcut {
  readonly id: string;
  readonly keys: string[]; // 例: ["Control", "1"] （押下順）
  readonly actions: IAppEvent[]; // 実行するスケジュールイベント群（順序を保持）

  constructor(params: { id: string; keys: string[]; actions: IAppEvent[] }) {
    this.id = params.id;
    this.keys = params.keys;
    this.actions = params.actions;
  }

  // キーボードトリガーで実行
  async execute(): Promise<void> {
    // Option A semantics: start each action in order but do not await
    // completion of each action (fire-and-forget ordering). This lets
    // actions such as audio playback and content show start nearly
    // simultaneously while preserving start order.
    for (const act of this.actions) {
      try {
        const p = act.execute(true, true);
        if (p && typeof (p as any).catch === "function") {
          (p as Promise<any>).catch(() => {
            // swallow to avoid unhandled rejection; individual events
            // should log their own errors if needed
          });
        }
      } catch (e) {
        // synchronous error while invoking execute; ignore to continue
      }
    }
  }

  // シリアライズ（保存用）
  serialize(): KeyboardShortcutData {
    return {
      id: this.id,
      keys: this.keys,
      actions: this.actions.map((a) => ({ type: a.type, ...a.serializeAsObject() })),
    };
  }

  // デシリアライズ（復元用）
  static fromData(data: KeyboardShortcutData): KeyboardShortcut {
    const { id, keys, actions: actionsData } = data;
    const events = (actionsData || []).map((actionData) => {
      const { type, ...params } = actionData;
      return getEventFromData(type, { id, ...params });
    });
    return new KeyboardShortcut({ id, keys, actions: events });
  }

  // デシリアライズ（復元用） - サービス層で実装
  static revive(_raw: string[]): KeyboardShortcut | null {
    return null;
  }
}
