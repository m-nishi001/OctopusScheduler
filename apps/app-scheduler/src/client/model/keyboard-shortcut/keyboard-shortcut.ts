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
}
