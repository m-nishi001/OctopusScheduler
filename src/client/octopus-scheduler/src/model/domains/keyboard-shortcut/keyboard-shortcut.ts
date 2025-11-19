import type { IAppEvent } from "../app-event/app-event";
import { getEventFromData } from "../app-event/event-registry";
// NOTE: event bus is not required here since we use polymorphic execute

export interface KeyboardShortcutData {
  id: string;
  keys: string[];
  action: {
    type: string;
    [key: string]: any;
  };
}

export class KeyboardShortcut {
  readonly id: string;
  readonly keys: string[]; // 例: ["Control", "1"] （押下順）
  readonly action: IAppEvent; // 実行するスケジュールイベント（例: TransitionPageEvent）

  constructor(params: { id: string; keys: string[]; action: IAppEvent }) {
    this.id = params.id;
    this.keys = params.keys;
    this.action = params.action;
  }

  // キーボードトリガーで実行
  async execute(): Promise<void> {
    // Use polymorphism: call event.execute(isStart = true, manual = true)
    // so that each event can decide how to behave for manual triggers.
    try {
      await this.action.execute(true, true);
    } catch (e) {
      // Fallback to old behavior — schedule start without manual flag
      await this.action.execute(true);
    }
  }

  // シリアライズ（保存用）
  serialize(): KeyboardShortcutData {
    return {
      id: this.id,
      keys: this.keys,
      action: {
        type: this.action.type,
        ...this.action.serializeAsObject(),
      },
    };
  }

  // デシリアライズ（復元用）
  static fromData(data: KeyboardShortcutData): KeyboardShortcut {
    const { id, keys, action: actionData } = data;
    const { type, ...params } = actionData;
    const event = getEventFromData(type, { id, ...params });
    return new KeyboardShortcut({ id, keys, action: event });
  }

  // デシリアライズ（復元用） - サービス層で実装
  static revive(_raw: string[]): KeyboardShortcut | null {
    return null;
  }
}
