import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrizeRepository } from "./prize-repository";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

function makeFakeApi() {
  return {
    addDriveData: vi.fn(),
    getDriveMetaData: vi.fn(),
    getDriveData: vi.fn(),
    updateDriveData: vi.fn(),
    addJson: vi.fn(async (d: any) => ({
      driveDataId: d.fileName,
      fileId: `folder1/${d.fileName}`,
      parentFolderId: "folder1",
      lastUpdate: new Date().toISOString(),
    })),
    getJson: vi.fn(async () => ({ json: "[]", updatedAt: null })),
  };
}

describe("PrizeRepository.listSyncTargets", () => {
  let fakeApi: ReturnType<typeof makeFakeApi>;
  let repo: PrizeRepository;

  beforeEach(async () => {
    await new LocalStorageService("jackpot-game", "PrizeData").clear();
    await new LocalStorageService("jackpot-game", "SyncDirtyTracker").clear();
    fakeApi = makeFakeApi();
    repo = new PrizeRepository(fakeApi as any);
  });

  it("returns no local/remote snapshot when nothing exists on either side", async () => {
    const [target] = await repo.listSyncTargets();
    expect(await target.getLocal()).toBeNull();
    expect(await target.getRemote()).toBeNull();
  });

  it("push uploads all local prizes as a single JSON blob without an appFileId (so it always overwrites prizes.json in place)", async () => {
    await repo.addPrizes([{ id: "p1", name: "Prize1", order: 1 }]);

    const [target] = await repo.listSyncTargets();
    const local = await target.getLocal();
    expect(local).not.toBeNull();
    await target.push(local!.data);

    expect(fakeApi.addJson).toHaveBeenCalledOnce();
    const payload = fakeApi.addJson.mock.calls[0][0];
    expect(payload.appFileId).toBeUndefined();
    expect(payload.fileName).toBe("prizes.json");
    expect(JSON.parse(payload.jsonText)).toEqual([
      { id: "p1", name: "Prize1", order: 1 },
    ]);
  });

  it("pull replaces all local prizes with the remote snapshot", async () => {
    const [target] = await repo.listSyncTargets();
    await target.pull([{ id: "p1", name: "Remote Prize", order: 1 }]);

    const prizes = await repo.getPrizes();
    expect(prizes).toEqual([{ id: "p1", name: "Remote Prize", order: 1 }]);
  });

  it("getRemote resolves via getJson() with no fileId, relying on the default-file fallback", async () => {
    fakeApi.getJson.mockResolvedValue({
      json: JSON.stringify([{ id: "p1", name: "Remote", order: 1 }]),
      updatedAt: new Date().toISOString(),
    });

    const [target] = await repo.listSyncTargets();
    const remote = await target.getRemote();

    expect(fakeApi.getJson).toHaveBeenCalledWith();
    expect(remote).not.toBeNull();
    expect(remote!.data).toEqual([{ id: "p1", name: "Remote", order: 1 }]);
  });
});
