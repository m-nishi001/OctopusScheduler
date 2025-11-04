import { ref } from "vue";

export function useKeyCapture() {
  const capturedKeys = ref<string[]>([]);
  const capturing = ref(false);

  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  let keyupHandler: ((event: KeyboardEvent) => void) | null = null;

  const startKeyCapture = () => {
    capturing.value = true;
    capturedKeys.value = [];
    keydownHandler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      updateCapturedKeys(event);
    };
    keyupHandler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      updateCapturedKeys(event);
    };
    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("keyup", keyupHandler);
  };

  const stopKeyCapture = () => {
    if (keydownHandler) {
      window.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }
    if (keyupHandler) {
      window.removeEventListener("keyup", keyupHandler);
      keyupHandler = null;
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

  const updateCapturedKeys = (event: KeyboardEvent) => {
    const keys: string[] = [];
    if (event.ctrlKey || (event.type === "keydown" && event.key === "Control"))
      keys.push("Control");
    if (event.shiftKey || (event.type === "keydown" && event.key === "Shift"))
      keys.push("Shift");
    if (event.altKey || (event.type === "keydown" && event.key === "Alt"))
      keys.push("Alt");
    if (event.metaKey || (event.type === "keydown" && event.key === "Meta"))
      keys.push("Meta");
    if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
      keys.push(event.key);
    }
    capturedKeys.value = keys;
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
