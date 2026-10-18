import { describe, it, expect, vi } from 'vitest';
import { useEndingExit } from './use-ending-exit';

describe('useEndingExit', () => {
  it('sends the host back to the session lobby', () => {
    const push = vi.fn();
    const { exitToLobby } = useEndingExit({ lobbyPath: () => '/session/host/s1', push });

    expect(exitToLobby()).toBe(true);
    expect(push).toHaveBeenCalledWith('/session/host/s1');
  });

  it('stays on the ending screen when not connected as host (preview)', () => {
    const push = vi.fn();
    const { exitToLobby } = useEndingExit({ lobbyPath: () => null, push });

    expect(exitToLobby()).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
