import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { KeyboardShortcutWireItem } from "./scheduler-api-contract";

export interface KeyboardShortcutsUseCaseDeps {
  kv: IKeyValueStorage;
}

// 1キーにshortcuts+config+updatedAtをまとめて保存する(バックグラウンド同期の
// 更新日時はクライアントが刻んだものをそのまま保存し、そのまま返す。サーバーの時刻は使わない)。
const STATE_KEY = "keyboard-shortcuts-state";

interface KeyboardShortcutsState {
  shortcuts: KeyboardShortcutWireItem[];
  config: unknown;
  updatedAt: string;
}

/** 保存されているキーボードショートカットと設定を返す。 */
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

  return { shortcuts: [], config: { enabled: true }, updatedAt: null };
}

/** キーボードショートカットと設定を、更新日時とあわせて1つのキーに保存する(更新日時は同期の後勝ち判定に使う)。 */
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
