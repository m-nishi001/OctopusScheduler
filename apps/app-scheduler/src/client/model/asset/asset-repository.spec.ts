import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { AssetRepository } from "./asset-repository";

function makeFakeApi() {
  return {
    getDriveMetaData: vi.fn(async () => []),
    getDriveData: vi.fn(),
    addDriveData: vi.fn(async (d: any) => ({ ...d.metadata, fileId: "file-1" })),
    updateDriveData: vi.fn(async () => undefined),
  } as any;
}

describe("AssetRepository.listSyncTargets", () => {
  let fakeApi: ReturnType<typeof makeFakeApi>;
  let repo: AssetRepository;

  beforeEach(async () => {
    // AssetRepository always opens the same "octopus-scheduler"/"Asset"
    // localforage store, so state must be reset between tests explicitly.
    await new LocalStorageService("octopus-scheduler", "Asset").clear();
    fakeApi = makeFakeApi();
    repo = new AssetRepository(fakeApi);
  });

  it("returns one target per local-only asset, resolving to push", async () => {
    await repo.addAssets([
      {
        id: "a1",
        // jsdom's FileReader rejects a cross-realm Blob instance, and blob
        // content is irrelevant to this test (it only asserts which API
        // method gets called), so a falsy blob takes the "" fallback path.
        blob: undefined as unknown as Blob,
        name: "a1.txt",
        uploadedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        size: 5,
      },
    ]);

    const targets = await repo.listSyncTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe("a1");
    expect(targets[0].kind).toBe("asset");

    const local = await targets[0].getLocal();
    const remote = await targets[0].getRemote();
    expect(local).not.toBeNull();
    expect(remote).toBeNull();

    await targets[0].push(local!.data);
    expect(fakeApi.addDriveData).toHaveBeenCalledOnce();
  });

  it("includes remote-only assets so they can be pulled down", async () => {
    fakeApi.getDriveMetaData.mockResolvedValue([
      {
        driveDataId: "remote-1",
        fileId: "file-remote-1",
        parentFolderId: "",
        lastUpdate: new Date().toISOString(),
      },
    ]);

    const targets = await repo.listSyncTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe("remote-1");

    const local = await targets[0].getLocal();
    const remote = await targets[0].getRemote();
    expect(local).toBeNull();
    expect(remote).not.toBeNull();
  });

  it("calls updateDriveData (not addDriveData) when a remote counterpart already exists", async () => {
    fakeApi.getDriveMetaData.mockResolvedValue([
      {
        driveDataId: "a1",
        fileId: "file-1",
        parentFolderId: "",
        lastUpdate: new Date(0).toISOString(),
      },
    ]);
    await repo.addAssets([
      {
        id: "a1",
        blob: undefined as unknown as Blob,
        name: "a1.txt",
        uploadedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        size: 5,
      },
    ]);

    const [target] = await repo.listSyncTargets();
    const local = await target.getLocal();
    await target.push(local!.data);

    expect(fakeApi.updateDriveData).toHaveBeenCalledOnce();
    expect(fakeApi.addDriveData).not.toHaveBeenCalled();
  });
});
