import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { KeyboardShortcutWireItem } from "./scheduler-api-contract";

export interface KeyboardShortcutsUseCaseDeps {
  kv: IKeyValueStorage;
}

// 1キーにshortcuts+config+updatedAtをまとめて保存する(バックグラウンド同期の
// Last-Write-Winsに使うタイムスタンプはクライアントがpush時に刻む)。
const STATE_KEY = "keyboard-shortcuts-state";

// 旧形式(タイムスタンプを持たない2キー)からのフォールバック読み取り用。
// STATE_KEYが一度も書かれていない既存インストールのために残す。
const LEGACY_SHORTCUTS_KEY = "keyboard-shortcuts";
const LEGACY_SHORTCUTS_CONFIG_KEY = "keyboard-shortcuts-config";

interface KeyboardShortcutsState {
  shortcuts: KeyboardShortcutWireItem[];
  config: unknown;
  updatedAt: string;
}

export async function getKeyboardShortcuts(
  deps: KeyboardShortcutsUseCaseDeps
): Promise<{
  shortcuts: KeyboardShortcutWireItem[];
  config: unknown;
  updatedAt: string | null;
}> {
  const stateStr = await deps.kv.get(STATE_KEY);
  if (stateStr) {
    const state = JSON.parse(stateStr) as KeyboardShortcutsState;
    return {
      shortcuts: state.shortcuts,
      config: state.config,
      updatedAt: state.updatedAt,
    };
  }

  const [shortcutsStr, configStr] = await Promise.all([
    deps.kv.get(LEGACY_SHORTCUTS_KEY),
    deps.kv.get(LEGACY_SHORTCUTS_CONFIG_KEY),
  ]);
  return {
    shortcuts: shortcutsStr ? JSON.parse(shortcutsStr) : [],
    config: configStr ? JSON.parse(configStr) : { enabled: true },
    updatedAt: null,
  };
}

export async function setKeyboardShortcuts(
  deps: KeyboardShortcutsUseCaseDeps,
  payload: {
    shortcuts: KeyboardShortcutWireItem[];
    config: unknown;
    updatedAt: string;
  }
): Promise<void> {
  const state: KeyboardShortcutsState = {
    shortcuts: payload.shortcuts,
    config: payload.config,
    updatedAt: payload.updatedAt,
  };
  await deps.kv.set(STATE_KEY, JSON.stringify(state));
}
