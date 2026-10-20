export interface KeyboardShortcutConfigData {
  enabled: boolean;
}

/** キーボードショートカット全体の設定(有効・無効)。 */
export class KeyboardShortcutConfig {
  readonly enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  static createEmpty(): KeyboardShortcutConfig {
    return new KeyboardShortcutConfig(true);
  }

  serialize(): KeyboardShortcutConfigData {
    return { enabled: this.enabled };
  }

  static fromData(data: KeyboardShortcutConfigData): KeyboardShortcutConfig {
    return new KeyboardShortcutConfig(data.enabled);
  }
}
