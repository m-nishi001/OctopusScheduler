import { ref } from "vue";

export function useKeyCapture() {
  const capturedKeys = ref<string[]>([]);
  const capturing = ref(false);

  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  let sequenceTimer: number | null = null;
  const MAX_KEYS = 3;
  const SEQUENCE_TIMEOUT_MS = 1500;

  const startKeyCapture = () => {
    capturing.value = true;
    capturedKeys.value = [];
    keydownHandler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      updateCapturedKeys(event);
    };
    window.addEventListener("keydown", keydownHandler);
  };

  const stopKeyCapture = () => {
    if (keydownHandler) {
      window.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }
    if (sequenceTimer) {
      clearTimeout(sequenceTimer);
      sequenceTimer = null;
    }
    capturing.value = false;
  };

  const toggleCapture = () => {
    if (capturing.value) {
      stopKeyCapture();
    } else {
      startKeyCapture();
    }
  };

  const pushKeysToCaptured = (toPush: string[]) => {
    // Append non-duplicate keys and maintain ordering up to MAX_KEYS
    for (const k of toPush) {
      if (!capturedKeys.value.includes(k)) {
        capturedKeys.value.push(k);
        if (capturedKeys.value.length > MAX_KEYS) {
          // remove oldest
          capturedKeys.value.shift();
        }
      }
    }
  };

  const updateCapturedKeys = (event: KeyboardEvent) => {
    const keys: string[] = [];
    if (event.ctrlKey && !capturedKeys.value.includes("Control"))
      keys.push("Control");
    if (event.shiftKey && !capturedKeys.value.includes("Shift"))
      keys.push("Shift");
    if (event.altKey && !capturedKeys.value.includes("Alt")) keys.push("Alt");
    if (event.metaKey && !capturedKeys.value.includes("Meta"))
      keys.push("Meta");
    if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
      if (!capturedKeys.value.includes(event.key)) keys.push(event.key);
    }
    pushKeysToCaptured(keys);

    // reset timeout
    if (sequenceTimer) clearTimeout(sequenceTimer);
    sequenceTimer = window.setTimeout(() => {
      // Stop capturing after a pause, but keep the capturedKeys so the user can save
      sequenceTimer = null;
      capturing.value = false;
      if (keydownHandler) {
        window.removeEventListener("keydown", keydownHandler);
        keydownHandler = null;
      }
    }, SEQUENCE_TIMEOUT_MS);
  };

  const clearKeys = () => {
    capturedKeys.value = [];
    capturing.value = false;
    stopKeyCapture();
  };

  return {
    capturedKeys,
    capturing,
    startKeyCapture,
    stopKeyCapture,
    toggleCapture,
    clearKeys,
  };
}
