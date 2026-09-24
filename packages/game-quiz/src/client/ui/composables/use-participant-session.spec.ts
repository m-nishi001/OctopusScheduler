import { describe, it, expect, vi } from "vitest";
import type {
  ParticipantSessionStorage,
  UseParticipantSessionDeps,
} from "./use-participant-session";
import { useParticipantSession } from "./use-participant-session";

function createFakeStorage(initial: Record<string, unknown> = {}): ParticipantSessionStorage {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    get: vi.fn(async <T>(id: string) => map.get(id) as T | undefined),
    save: vi.fn(async <T>(id: string, value: T) => {
      map.set(id, value);
    }),
    remove: vi.fn(async (id: string) => {
      map.delete(id);
    }),
  };
}

function createDeps(overrides: Partial<UseParticipantSessionDeps> = {}) {
  return {
    loginUseCase: { execute: vi.fn() },
    resolveUseCase: { execute: vi.fn() },
    storage: createFakeStorage(),
    ...overrides,
  };
}

describe("useParticipantSession", () => {
  it("has no session when the device has no stored token", async () => {
    const deps = createDeps();
    const { session, isRestoring, restore } = useParticipantSession(deps);

    await restore();

    expect(session.value).toBeNull();
    expect(isRestoring.value).toBe(false);
  });

  it("restores a session from a stored device token", async () => {
    const storedSession = { token: "tok-1", userId: "u1", displayName: "太郎" };
    const deps = createDeps({
      storage: createFakeStorage({ "device-token": "tok-1" }),
      resolveUseCase: { execute: vi.fn().mockResolvedValue(storedSession) },
    });
    const { session, restore } = useParticipantSession(deps);

    await restore();

    expect(deps.resolveUseCase.execute).toHaveBeenCalledWith("tok-1");
    expect(session.value).toEqual(storedSession);
  });

  it("discards an invalid stored token and requires re-login", async () => {
    const storage = createFakeStorage({ "device-token": "expired" });
    const deps = createDeps({
      storage,
      resolveUseCase: { execute: vi.fn().mockRejectedValue(new Error("invalid")) },
    });
    const { session, restore } = useParticipantSession(deps);

    await restore();

    expect(session.value).toBeNull();
    expect(storage.remove).toHaveBeenCalledWith("device-token");
  });

  it("logs in, saves the device token, and sets the session", async () => {
    const newSession = { token: "tok-2", userId: "u2", displayName: "次郎" };
    const storage = createFakeStorage();
    const deps = createDeps({
      storage,
      loginUseCase: { execute: vi.fn().mockResolvedValue(newSession) },
    });
    const { session, login } = useParticipantSession(deps);

    await login("u2");

    expect(session.value).toEqual(newSession);
    expect(storage.save).toHaveBeenCalledWith("device-token", "tok-2");
  });

  it("surfaces a login error without setting a session", async () => {
    const deps = createDeps({
      loginUseCase: { execute: vi.fn().mockRejectedValue(new Error("not found")) },
    });
    const { session, loginError, login } = useParticipantSession(deps);

    await login("unknown");

    expect(session.value).toBeNull();
    expect(loginError.value).toBe("not found");
  });
});
