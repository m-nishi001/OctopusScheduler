export type InputTrigger = (ev?: KeyboardEvent) => void;

export type InputControllerOptions = {
  minIntervalMs?: number;
};

export function createInputController(opts: InputControllerOptions = {}) {
  const minIntervalMs = opts.minIntervalMs ?? 1000;

  let attached = false;
  let onTrigger: InputTrigger | null = null;
  let pressed = false; // to ignore key repeat
  let lastTriggerTs = -minIntervalMs; // allow immediate first trigger
  let suspended = false;
  let repeatTimer: number | null = null;

  const keydown = (ev: KeyboardEvent) => {
    if (suspended) return;
    if (ev.key !== "Enter") return;
    // on first keydown start a repeat mechanism so a long-press
    // will repeatedly trigger at interval `minIntervalMs`. This
    // preserves the original minimum spacing while allowing
    // long-press automation requested by tests/users.
    if (pressed) return;
    pressed = true;

    const tryTrigger = (e?: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastTriggerTs < minIntervalMs) return false;
      lastTriggerTs = now;
      try {
        onTrigger?.(e);
      } catch (err) {
        // swallow handler errors
      }
      return true;
    };

    // immediate attempt
    tryTrigger(ev);

    // schedule repeated triggers while key is held
    if (repeatTimer == null) {
      repeatTimer = window.setInterval(() => {
        if (suspended) return;
        tryTrigger();
      }, minIntervalMs) as unknown as number;
    }
  };

  const keyup = (ev: KeyboardEvent) => {
    if (ev.key !== "Enter") return;
    pressed = false;
    if (repeatTimer != null) {
      clearInterval(repeatTimer);
      repeatTimer = null;
    }
  };

  return {
    attach() {
      if (attached) return;
      window.addEventListener("keydown", keydown);
      window.addEventListener("keyup", keyup);
      attached = true;
    },
    detach() {
      if (!attached) return;
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      if (repeatTimer != null) {
        clearInterval(repeatTimer);
        repeatTimer = null;
      }
      attached = false;
    },
    setOnTrigger(fn: InputTrigger | null) {
      onTrigger = fn;
    },
    suspend() {
      suspended = true;
    },
    resume() {
      suspended = false;
    },
    // expose for tests
    _internal: {
      getLastTriggerTs: () => lastTriggerTs,
    },
  } as const;
}

export default createInputController;
