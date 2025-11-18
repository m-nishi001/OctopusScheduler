import { container } from 'tsyringe';
import { KeyboardShortcutService } from '../../../model/applications/keyboard-shortcut/keyboard-shortcut-service';

export function registerKeyboardShortcutListener(): () => void {
  const keyboardShortcutService = container.resolve(KeyboardShortcutService);
  let sequence: string[] = [];
  let sequenceTimer: number | null = null;
  let pendingExecutionTimer: number | null = null;
  const MAX_KEYS = 3;
  const SEQUENCE_TIMEOUT_MS = 1500;
  const PENDING_TIMEOUT_MS = 400;

  const handler = async (event: KeyboardEvent) => {
    // 入力フィールド内は無視
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;

    const keysToAppend: string[] = [];
    if (event.ctrlKey && !sequence.includes('Control')) keysToAppend.push('Control');
    if (event.shiftKey && !sequence.includes('Shift')) keysToAppend.push('Shift');
    if (event.altKey && !sequence.includes('Alt')) keysToAppend.push('Alt');
    if (event.metaKey && !sequence.includes('Meta')) keysToAppend.push('Meta');
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
      if (!sequence.includes(event.key)) keysToAppend.push(event.key);
    }

    const enabled = await keyboardShortcutService.isEnabled();
    if (!enabled) return;

    if (keysToAppend.length === 0) return;

    // Append keys to sequence
    for (const k of keysToAppend) {
      if (!sequence.includes(k)) sequence.push(k);
    }
    // Keep length within MAX_KEYS
    while (sequence.length > MAX_KEYS) sequence.shift();

    // reset sequence timeout
    if (sequenceTimer) clearTimeout(sequenceTimer);
    sequenceTimer = window.setTimeout(() => {
      sequence = [];
      sequenceTimer = null;
      if (pendingExecutionTimer) {
        clearTimeout(pendingExecutionTimer);
        pendingExecutionTimer = null;
      }
    }, SEQUENCE_TIMEOUT_MS);

    // Cancel any pending execution when sequence changes
    if (pendingExecutionTimer) {
      clearTimeout(pendingExecutionTimer);
      pendingExecutionTimer = null;
    }

    // Check for exact match
    const shortcut = await keyboardShortcutService.findShortcutByKeys(sequence);
    if (shortcut) {
      // If there is a longer shortcut that starts with the same sequence, wait a short time
      const hasLonger = await keyboardShortcutService.hasLongerShortcutWithPrefix(sequence);
      if (hasLonger) {
        pendingExecutionTimer = window.setTimeout(async () => {
          try {
            event.preventDefault();
            await shortcut.execute();
          } finally {
            sequence = [];
            pendingExecutionTimer = null;
            if (sequenceTimer) {
              clearTimeout(sequenceTimer);
              sequenceTimer = null;
            }
          }
        }, PENDING_TIMEOUT_MS);
      } else {
        event.preventDefault();
        await shortcut.execute();
        // clear sequence
        sequence = [];
        if (sequenceTimer) {
          clearTimeout(sequenceTimer);
          sequenceTimer = null;
        }
      }
      return;
    }

    // If no exact match but some longer shortcuts start with this prefix, wait for more input
    const hasLongerPrefix = (await keyboardShortcutService.getKeyboardShortcuts()).some((s) => s.keys.length > sequence.length && s.keys.slice(0, sequence.length).every((k, i) => k === sequence[i]));
    if (hasLongerPrefix) {
      // wait for more input or timeout
      return;
    }

    // No match and no longer prefix -> reset
    sequence = [];
    if (sequenceTimer) {
      clearTimeout(sequenceTimer);
      sequenceTimer = null;
    }
  };

  window.addEventListener('keydown', handler);

  // return an unregister function
  return () => {
    window.removeEventListener('keydown', handler);
    if (sequenceTimer) clearTimeout(sequenceTimer);
    if (pendingExecutionTimer) clearTimeout(pendingExecutionTimer);
    sequence = [];
  };
}

export default registerKeyboardShortcutListener;
