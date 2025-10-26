import { onUnmounted } from 'vue';

export function waitForEnter(): Promise<void> {
  return new Promise<void>((resolve) => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        document.removeEventListener('keydown', handler);
        resolve();
      }
    };
    document.addEventListener('keydown', handler);
  });
}

export function useEnterHandler(cb: (e: KeyboardEvent) => void) {
  const handler = (e: KeyboardEvent) => cb(e);
  window.addEventListener('keydown', handler);
  onUnmounted(() => window.removeEventListener('keydown', handler));
  return { dispose: () => window.removeEventListener('keydown', handler) };
}
