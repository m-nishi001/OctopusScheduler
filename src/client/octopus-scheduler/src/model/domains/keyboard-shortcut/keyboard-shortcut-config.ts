export class KeyboardShortcutConfig {
  readonly enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  static createEmpty(): KeyboardShortcutConfig {
    return new KeyboardShortcutConfig(true);
  }

  serialize(): string[] {
    return [this.enabled.toString()];
  }

  static revive(raw: string[]): KeyboardShortcutConfig {
    const enabled = raw[0] === "true";
    return new KeyboardShortcutConfig(enabled);
  }
}
