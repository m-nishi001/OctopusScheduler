import type { IScheduleEvent } from "../schedule-event/schedule-event";
import { getEventFromData } from "../schedule-event/event-registry";

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
  readonly action: IScheduleEvent; // 実行するスケジュールイベント（例: TransitionPageEvent）

  constructor(params: { id: string; keys: string[]; action: IScheduleEvent }) {
    this.id = params.id;
    this.keys = params.keys;
    this.action = params.action;
  }

  // キーボードトリガーで実行
  async execute(): Promise<void> {
    await this.action.execute(true);
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
