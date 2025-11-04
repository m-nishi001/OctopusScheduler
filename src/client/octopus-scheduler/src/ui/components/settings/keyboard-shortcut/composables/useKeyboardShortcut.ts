import { ref } from "vue";
import { container } from "tsyringe";
import { KeyboardShortcutService } from "model/applications/keyboard-shortcut/keyboard-shortcut-service";
import { KeyboardShortcut } from "model/domains/keyboard-shortcut/keyboard-shortcut";
import { KeyboardShortcutConfig } from "model/domains/keyboard-shortcut/keyboard-shortcut-config";

export function useKeyboardShortcut() {
  const shortcuts = ref<KeyboardShortcut[]>([]);
  const isEnabled = ref(true);
  const service: KeyboardShortcutService = container.resolve(
    KeyboardShortcutService
  );

  const loadShortcuts = async () => {
    shortcuts.value = await service.getKeyboardShortcuts();
  };

  const loadConfig = async () => {
    const config = await service.getConfig();
    isEnabled.value = config.enabled;
  };

  const onToggleEnabled = async () => {
    const config = new KeyboardShortcutConfig(isEnabled.value);
    await service.saveConfig(config);
  };

  const onDelete = async (id: string) => {
    if (confirm("削除しますか？")) {
      await service.deleteKeyboardShortcut(id);
      await loadShortcuts();
    }
  };

  const saveShortcut = async (shortcut: KeyboardShortcut) => {
    await service.addKeyboardShortcut(shortcut);
    await loadShortcuts();
  };

  const deleteShortcut = async (id: string) => {
    await service.deleteKeyboardShortcut(id);
    await loadShortcuts();
  };

  const syncWithServer = async (direction: "gas-to-local" | "local-to-gas") => {
    await service.syncWithServer(direction);
    await loadShortcuts();
    await loadConfig();
  };

  return {
    shortcuts,
    isEnabled,
    loadShortcuts,
    loadConfig,
    onToggleEnabled,
    onDelete,
    saveShortcut,
    deleteShortcut,
    syncWithServer,
  };
}
