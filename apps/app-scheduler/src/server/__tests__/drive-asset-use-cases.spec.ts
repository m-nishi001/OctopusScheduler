import { describe, it, expect } from "vitest";
import { InMemoryCache, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addSchedulerDriveData,
  getSchedulerDriveMetadata,
} from "../drive-asset-use-cases";

const dataUrl = `data:image/png;base64,${Buffer.from("x").toString("base64")}`;

function makeData(id: string, parentFolderId = "client-supplied") {
  return {
    metadata: { driveDataId: id, fileId: "", parentFolderId, lastUpdate: "" },
    fileName: `${id}.png`,
    fileKind: "image/png",
    fileDataUrl: dataUrl,
    uploadDate: "",
    parentFolderId,
  };
}

describe("scheduler drive asset use-cases", () => {
  it("stores assets under octopus-scheduler/assets regardless of the client parentFolderId", async () => {
    const deps = { storage: new InMemoryKeyValueStorage(), cache: new InMemoryCache() };

    const added = await addSchedulerDriveData(deps, makeData("a"));

    expect(added.data?.fileId.startsWith("octopus-scheduler/assets/")).toBe(true);
    expect(added.data?.parentFolderId).toBe("octopus-scheduler/assets");
  });

  it("lists a sub-folder under assets when a folder name is given", async () => {
    const storage = new InMemoryKeyValueStorage();
    const deps = { storage, cache: new InMemoryCache() };
    await storage.putBinary("octopus-scheduler/assets/show1/b.png", "eA==", "image/png");

    const sub = await getSchedulerDriveMetadata(deps, " show1 ");
    expect(sub.map((m) => m.fileId)).toEqual(["octopus-scheduler/assets/show1/b.png"]);
  });

  it("rejects a folder name that is not a single path segment", async () => {
    const deps = { storage: new InMemoryKeyValueStorage(), cache: new InMemoryCache() };
    await expect(getSchedulerDriveMetadata(deps, "../x")).rejects.toThrow(/Invalid storage path/);
  });
});
