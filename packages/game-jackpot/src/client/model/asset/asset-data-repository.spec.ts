import { describe, it, expect, beforeEach, vi } from "vitest";
import { AssetDataRepository } from "./asset-data-repository";
import { Asset } from "./asset-data";
import { container } from "tsyringe";
import { CryptoIdGenerator } from "../common/crypto-id-generator";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

/** サーバーが付ける更新日時。端末の時計(いま)とは大きく違う値にして、どちらを採ったか区別できるようにする。 */
const SERVER_TIME = "2020-01-01T00:00:00.000Z";

describe("AssetDataRepository", () => {
  let repo: AssetDataRepository;

  beforeEach(() => {
    // Reset container to avoid interference
    container.reset();

    // Mock IdGenerator
    const mockIdGenerator = {
      nextId: vi.fn(() => "generated-id"),
    };
    container.register(CryptoIdGenerator, { useValue: mockIdGenerator });

    // Mock JackpotGameApi: these tests only exercise local-storage-backed
    // methods, but the constructor still needs a resolvable token.
    const mockJackpotApi = {
      addDriveData: vi.fn(),
      getDriveMetaData: vi.fn(async () => []),
      getDriveData: vi.fn(),
      updateDriveData: vi.fn(),
      addJson: vi.fn(),
      getJson: vi.fn(),
    };
    container.register(IJackpotGameApiToken, { useValue: mockJackpotApi });

    repo = container.resolve(AssetDataRepository);
  });

  it("should preserve dto.id when provided", async () => {
    const blob = new Blob(["test"], { type: "audio/mpeg" });
    const dto = new Asset(
      "my-id-123",
      "audio/mpeg",
      "test.mp3",
      new Date().toISOString(),
      new Date().toISOString(),
      4,
      blob
    );
    const updated = await repo.addAssetData([dto]);
    expect(updated.length).toBe(1);
    expect(updated[0].id).toBe("my-id-123");
    const fetched = await repo.getAssetDataById("my-id-123");
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe("my-id-123");
  });

  it("should generate id when dto.id is empty", async () => {
    const blob = new Blob(["t"], { type: "audio/mpeg" });
    const dto = new Asset(
      "",
      "audio/mpeg",
      "nobody.mp3",
      new Date().toISOString(),
      new Date().toISOString(),
      1,
      blob
    );
    const updated = await repo.addAssetData([dto]);
    expect(updated.length).toBe(1);
    expect(updated[0].id).toBeTruthy();
    const fetched = await repo.getAssetDataById(updated[0].id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(updated[0].id);
  });
});

describe("AssetDataRepository.listSyncTargets", () => {
  let mockJackpotApi: {
    addDriveData: ReturnType<typeof vi.fn>;
    getDriveMetaData: ReturnType<typeof vi.fn>;
    getDriveData: ReturnType<typeof vi.fn>;
    updateDriveData: ReturnType<typeof vi.fn>;
  };
  let repo: AssetDataRepository;

  beforeEach(async () => {
    container.reset();
    await new LocalStorageService("jackpot-game", "AssetData").clear();

    container.register(CryptoIdGenerator, { useValue: { nextId: () => "generated-id" } });
    mockJackpotApi = {
      addDriveData: vi.fn(async (d: any) => ({ ...d.metadata, fileId: "file-1", lastUpdate: SERVER_TIME })),
      getDriveMetaData: vi.fn(async () => []),
      getDriveData: vi.fn(),
      updateDriveData: vi.fn(async (d: any) => ({ ...d.metadata, fileId: "file-1", lastUpdate: SERVER_TIME })),
    };
    container.register(IJackpotGameApiToken, { useValue: mockJackpotApi });
    repo = container.resolve(AssetDataRepository);
  });

  it("returns one target per local-only asset, resolving to push via addDriveData", async () => {
    await repo.addAssetData([
      new Asset(
        "a1",
        "audio/mpeg",
        "a1.mp3",
        new Date().toISOString(),
        new Date().toISOString(),
        4,
        undefined as unknown as Blob
      ),
    ]);

    const targets = await repo.listSyncTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe("a1");
    expect(targets[0].kind).toBe("asset");

    const local = await targets[0].getLocal();
    expect(await targets[0].getRemote()).toBeNull();
    await targets[0].push(local!);

    expect(mockJackpotApi.addDriveData).toHaveBeenCalledOnce();
    // 端末の時計ではなく、サーバーが付けた更新日時をローカルにも残す(時計がずれた端末でも、新旧の比較が狂わない)
    expect((await targets[0].getLocal())!.updatedAt).toBe(new Date(SERVER_TIME).getTime());
  });

  it("includes remote-only assets so they can be pulled down", async () => {
    mockJackpotApi.getDriveMetaData.mockResolvedValue([
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
    expect(await targets[0].getLocal()).toBeNull();
    expect(await targets[0].getRemote()).not.toBeNull();
  });

  it("calls updateDriveData (not addDriveData) when a remote counterpart already exists", async () => {
    mockJackpotApi.getDriveMetaData.mockResolvedValue([
      {
        driveDataId: "a1",
        fileId: "file-1",
        parentFolderId: "",
        lastUpdate: new Date(0).toISOString(),
      },
    ]);
    await repo.addAssetData([
      new Asset(
        "a1",
        "audio/mpeg",
        "a1.mp3",
        new Date().toISOString(),
        new Date().toISOString(),
        4,
        undefined as unknown as Blob
      ),
    ]);

    const [target] = await repo.listSyncTargets();
    const local = await target.getLocal();
    await target.push(local!);

    expect(mockJackpotApi.updateDriveData).toHaveBeenCalledOnce();
    expect(mockJackpotApi.addDriveData).not.toHaveBeenCalled();
  });
});
