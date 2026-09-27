import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenConfigRepository } from "./screen-config-repository";
import { ScreenSetting } from "./screen-setting";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

function makeFakeApi() {
  return {
    addDriveData: vi.fn(),
    getDriveMetaData: vi.fn(),
    getDriveData: vi.fn(),
    updateDriveData: vi.fn(),
    addJson: vi.fn(async (d: any) => ({
      driveDataId: d.fileName,
      fileId: "folder1/screens.json",
      parentFolderId: "folder1",
      lastUpdate: new Date().toISOString(),
    })),
    getJson: vi.fn(async () => ({ json: "[]", updatedAt: null })),
  };
}

describe("ScreenConfigRepository.listSyncTargets", () => {
  let fakeApi: ReturnType<typeof makeFakeApi>;
  let repo: ScreenConfigRepository;

  beforeEach(async () => {
    await new LocalStorageService("jackpot-game", "ScreenConfigData").clear();
    await new LocalStorageService("jackpot-game", "SyncDirtyTracker").clear();
    localStorage.removeItem("jackpot-screens-last-file-id");
    fakeApi = makeFakeApi();
    repo = new ScreenConfigRepository(fakeApi as any);
  });

  it("returns no local snapshot when no settings have been saved", async () => {
    const [target] = await repo.listSyncTargets();
    expect(await target.getLocal()).toBeNull();
  });

  it("returns no remote snapshot until a fileId has been learned", async () => {
    const [target] = await repo.listSyncTargets();
    expect(await target.getRemote()).toBeNull();
    expect(fakeApi.getJson).not.toHaveBeenCalled();
  });

  it("push uploads all local screen settings and remembers the returned fileId", async () => {
    await repo.updateScreenSettings([
      new ScreenSetting("home", "background", JSON.stringify({ color: "red" })),
    ]);

    const [target] = await repo.listSyncTargets();
    const local = await target.getLocal();
    expect(local).not.toBeNull();
    await target.push(local!.data);

    expect(fakeApi.addJson).toHaveBeenCalledOnce();
    expect(localStorage.getItem("jackpot-screens-last-file-id")).toBe(
      "folder1/screens.json"
    );
  });

  it("pull replaces all local screen settings with the remote snapshot", async () => {
    const [target] = await repo.listSyncTargets();
    await target.pull([
      new ScreenSetting("home", "background", JSON.stringify({ color: "blue" })),
    ]);

    const settings = await repo.getScreenSettings();
    expect(settings).toEqual([
      { screenName: "home", settingName: "background", settingValue: JSON.stringify({ color: "blue" }) },
    ]);
  });
});
