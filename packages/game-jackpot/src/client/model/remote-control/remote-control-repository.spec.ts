import { describe, it, expect, vi } from "vitest";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";
import { RemoteControlRepository } from "./remote-control-repository";

function createFakeApi(
  overrides: Partial<JackpotGameApi> = {}
): JackpotGameApi {
  return {
    addDriveData: vi.fn(),
    getDriveMetaData: vi.fn(),
    getDriveData: vi.fn(),
    addJson: vi.fn(),
    getJson: vi.fn(),
    setRemoteScreen: vi.fn(),
    advanceRemoteAction: vi.fn(),
    getRemoteControlState: vi.fn(),
    ...overrides,
  } as unknown as JackpotGameApi;
}

describe("RemoteControlRepository", () => {
  it("sets the remote screen via the API", async () => {
    const state = { screen: "opening" as const, actionSeq: 0, updatedAtMs: 1000 };
    const api = createFakeApi({
      setRemoteScreen: vi.fn().mockResolvedValue(state),
    });
    const repo = new RemoteControlRepository(api);

    await expect(repo.setScreen("opening")).resolves.toEqual(state);
    expect(api.setRemoteScreen).toHaveBeenCalledWith("opening");
  });

  it("advances the remote action via the API", async () => {
    const state = { screen: "main-draw" as const, actionSeq: 1, updatedAtMs: 2000 };
    const api = createFakeApi({
      advanceRemoteAction: vi.fn().mockResolvedValue(state),
    });
    const repo = new RemoteControlRepository(api);

    await expect(repo.advance()).resolves.toEqual(state);
    expect(api.advanceRemoteAction).toHaveBeenCalled();
  });

  it("gets the remote control state via the API", async () => {
    const state = { screen: null, actionSeq: 0, updatedAtMs: 0 };
    const api = createFakeApi({
      getRemoteControlState: vi.fn().mockResolvedValue(state),
    });
    const repo = new RemoteControlRepository(api);

    await expect(repo.getState()).resolves.toEqual(state);
    expect(api.getRemoteControlState).toHaveBeenCalled();
  });
});
