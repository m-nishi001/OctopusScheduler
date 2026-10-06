import { container } from "tsyringe";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { KeyboardShortcutService } from "../../control/keyboard-shortcut/keyboard-shortcut-service";
// AppEventService not required here
import { sendShortcutViaChannel } from "./send-shortcut-via-channel";

export function registerKeyboardShortcutListener(): () => void {
  const keyboardShortcutService = container.resolve(KeyboardShortcutService);
  let manualContentVisible = false;
  // update manual content visibility flag based on showContent/hideContent events
  const onShowContent = (data: any) => {
    manualContentVisible = !!data?.manual;
  };
  const onHideContent = () => {
    manualContentVisible = false;
  };
  eventBus.on("showContent", onShowContent);
  eventBus.on("hideContent", onHideContent);
  let sequence: string[] = [];
  let sequenceTimer: number | null = null;
  let pendingExecutionTimer: number | null = null;
  // 設定画面のキー入力(useKeyCapture)と同じ値を使うこと。ユーザー向け説明は settings/help/help-content.ts
  const MAX_KEYS = 3;
  // この時間キー入力が途絶えたら途中までの入力を破棄する
  const SEQUENCE_TIMEOUT_MS = 1500;
  // 「Ctrl→1」と「Ctrl→1→2」のように前方一致する長いショートカットがある場合、
  // 短い方を即実行せず、続きの入力が来ないかこの時間だけ待つ
  const PENDING_TIMEOUT_MS = 400;

  const handler = async (event: KeyboardEvent) => {
    // 入力フィールド内は無視
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;

    // ESCは予約キー(有効/無効設定に関わらず常に全停止)。ショートカットには割り当てられない。
    // ESC押下では画面遷移は行わず、再生停止のみ行う
    if (event.key === "Escape") {
      try {
        event.preventDefault();
      } catch {
        /* ignore */
      }
      // Emit stopAudio locally and broadcast stopAll to other tabs/windows
      try {
        eventBus.emit("stopAudio");
      } catch {
        // ignore
      }
      try {
        const ch = new BroadcastChannel("octopus-control");
        try {
          ch.postMessage({ actionType: "stopAll" });
        } catch {
          /* swallow */
        }
        try {
          ch.close();
        } catch {}
      } catch {
        // BroadcastChannel not available or failed -- ignore
      }
      // clear any pending sequences/timers
      sequence = [];
      if (sequenceTimer) {
        clearTimeout(sequenceTimer);
        sequenceTimer = null;
      }
      if (pendingExecutionTimer) {
        clearTimeout(pendingExecutionTimer);
        pendingExecutionTimer = null;
      }
      return;
    }

    const keysToAppend: string[] = [];
    if (event.ctrlKey && !sequence.includes("Control"))
      keysToAppend.push("Control");
    if (event.shiftKey && !sequence.includes("Shift"))
      keysToAppend.push("Shift");
    if (event.altKey && !sequence.includes("Alt")) keysToAppend.push("Alt");
    if (event.metaKey && !sequence.includes("Meta")) keysToAppend.push("Meta");
    if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
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
      const hasLonger =
        await keyboardShortcutService.hasLongerShortcutWithPrefix(sequence);
      // Instead of executing actions locally, send AppEventDto messages
      // over BroadcastChannel so the execute tab will perform the actions.
      const sendShortcut = async () => {
        try {
          await sendShortcutViaChannel((shortcut as any).eventIds || [], {
            manualContentVisible,
          });
        } catch (e) {
          // swallow errors to keep original behavior
        }
      };

      if (hasLonger) {
        pendingExecutionTimer = window.setTimeout(() => {
          try {
            event.preventDefault();
            sendShortcut();
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
        sendShortcut();
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
    const hasLongerPrefix = (
      await keyboardShortcutService.getKeyboardShortcuts()
    ).some(
      (s) =>
        s.keys.length > sequence.length &&
        s.keys.slice(0, sequence.length).every((k, i) => k === sequence[i])
    );
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

  window.addEventListener("keydown", handler);

  // return an unregister function
  return () => {
    window.removeEventListener("keydown", handler);
    if (sequenceTimer) clearTimeout(sequenceTimer);
    if (pendingExecutionTimer) clearTimeout(pendingExecutionTimer);
    sequence = [];
    eventBus.off("showContent", onShowContent);
    eventBus.off("hideContent", onHideContent);
  };
}

export default registerKeyboardShortcutListener;
