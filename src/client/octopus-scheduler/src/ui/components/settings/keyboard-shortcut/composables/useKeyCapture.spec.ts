import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useKeyCapture } from './useKeyCapture';

describe('useKeyCapture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures 3-key sequence across keydown events', async () => {
    const { capturedKeys, startKeyCapture, stopKeyCapture } = useKeyCapture();
    startKeyCapture();
    // simulate pressing Control key first
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true } as any));
    // then press S with control held
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true } as any));
    // then press 1
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' } as any));
    expect(capturedKeys.value).toEqual(['Control', 's', '1'] /* should be trimmed to 3 */);

    // extra input beyond 3 keys should shift
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' } as any));
    expect(capturedKeys.value.length).toBeLessThanOrEqual(3);

    stopKeyCapture();
  });
});
