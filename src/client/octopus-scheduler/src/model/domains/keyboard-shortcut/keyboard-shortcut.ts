import type { IScheduleEvent } from "../schedule-event/schedule-event";

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
  serialize(): string[] {
    return [
      this.id,
      JSON.stringify(this.keys),
      this.action.type,
      ...this.action.serialize(),
    ];
  }

  // デシリアライズ（復元用） - サービス層で実装
  static revive(_raw: string[]): KeyboardShortcut | null {
    return null;
  }
}
