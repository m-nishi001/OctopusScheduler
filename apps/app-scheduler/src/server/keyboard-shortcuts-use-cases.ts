import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { KeyboardShortcutWireItem } from "./scheduler-api-contract";

export interface KeyboardShortcutsUseCaseDeps {
  kv: IKeyValueStorage;
}

const SHORTCUTS_KEY = "keyboard-shortcuts";
const SHORTCUTS_CONFIG_KEY = "keyboard-shortcuts-config";

export async function getKeyboardShortcuts(deps: KeyboardShortcutsUseCaseDeps): Promise<{
  shortcuts: KeyboardShortcutWireItem[];
  config: unknown;
}> {
  const shortcutsStr = await deps.kv.get(SHORTCUTS_KEY);
  const configStr = await deps.kv.get(SHORTCUTS_CONFIG_KEY);
  const shortcuts = shortcutsStr ? JSON.parse(shortcutsStr) : [];
  const config = configStr ? JSON.parse(configStr) : { enabled: true };
  return { shortcuts, config };
}

export async function setKeyboardShortcuts(
  deps: KeyboardShortcutsUseCaseDeps,
  payload: { shortcuts: KeyboardShortcutWireItem[]; config: unknown }
): Promise<void> {
  await deps.kv.set(SHORTCUTS_KEY, JSON.stringify(payload.shortcuts));
  await deps.kv.set(SHORTCUTS_CONFIG_KEY, JSON.stringify(payload.config));
}
