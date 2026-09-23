import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";

export interface KeyboardShortcutsUseCaseDeps {
  kv: IKeyValueStorage;
}

const SHORTCUTS_KEY = "keyboard-shortcuts";
const SHORTCUTS_CONFIG_KEY = "keyboard-shortcuts-config";

export function getKeyboardShortcuts(deps: KeyboardShortcutsUseCaseDeps): {
  shortcuts: string[][];
  config: unknown;
} {
  const shortcutsStr = deps.kv.get(SHORTCUTS_KEY);
  const configStr = deps.kv.get(SHORTCUTS_CONFIG_KEY);
  const shortcuts = shortcutsStr ? JSON.parse(shortcutsStr) : [];
  const config = configStr ? JSON.parse(configStr) : { enabled: true };
  return { shortcuts, config };
}

export function setKeyboardShortcuts(
  deps: KeyboardShortcutsUseCaseDeps,
  payload: { shortcuts: string[][]; config: unknown }
): void {
  deps.kv.set(SHORTCUTS_KEY, JSON.stringify(payload.shortcuts));
  deps.kv.set(SHORTCUTS_CONFIG_KEY, JSON.stringify(payload.config));
}
