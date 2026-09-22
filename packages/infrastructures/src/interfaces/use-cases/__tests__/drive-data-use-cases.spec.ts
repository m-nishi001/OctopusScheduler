import { describe, it, expect } from "vitest";
import { InMemoryCacheRepository } from "./fakes/in-memory-cache-repository";
import { InMemoryFileStorageRepository } from "./fakes/in-memory-file-storage-repository";
import { addDriveData } from "../add-drive-data-use-case";
import { getDriveData } from "../get-drive-data-use-case";
import { getDriveMetadata } from "../get-drive-metadata-use-case";
import { updateDriveData } from "../update-drive-data-use-case";
import { removeDriveData } from "../remove-drive-data-use-case";
import type { DriveData } from "../../file-storage-repository";

function makeDriveData(overrides: Partial<DriveData> = {}): DriveData {
  return {
    metadata: {
      driveDataId: "item-1",
      fileId: "",
      parentFolderId: "folder-1",
      lastUpdate: "",
    },
    fileName: "photo.png",
    fileKind: "image/png",
    fileDataUrl: `data:image/png;base64,${Buffer.from("hello").toString("base64")}`,
    uploadDate: "",
    parentFolderId: "folder-1",
    ...overrides,
  };
}

describe("drive-data use-cases", () => {
  it("adds a new drive data item, then rejects a duplicate add", () => {
    const cache = new InMemoryCacheRepository();
    const fileStorage = new InMemoryFileStorageRepository();
    const deps = { cache, fileStorage };

    const first = addDriveData(deps, makeDriveData());
    expect(first.status).toBe("success");
    expect(first.data?.driveDataId).toBe("item-1");

    const second = addDriveData(deps, makeDriveData());
    expect(second.status).toBe("duplicate");
  });

  it("round-trips content through getDriveData", () => {
    const cache = new InMemoryCacheRepository();
    const fileStorage = new InMemoryFileStorageRepository();
    const deps = { cache, fileStorage };

    const added = addDriveData(deps, makeDriveData());
    const fileId = added.data!.fileId;

    const fetched = getDriveData({ fileStorage }, fileId);
    expect(fetched).not.toBeNull();
    expect(fetched!.fileName).toBe("photo.png");
    expect(fetched!.metadata.driveDataId).toBe("item-1");
    expect(fetched!.fileDataUrl).toContain("base64,");
  });

  it("lists metadata for a folder", () => {
    const cache = new InMemoryCacheRepository();
    const fileStorage = new InMemoryFileStorageRepository();
    const deps = { cache, fileStorage };

    addDriveData(deps, makeDriveData());
    addDriveData(deps, makeDriveData({ metadata: { driveDataId: "item-2", fileId: "", parentFolderId: "folder-1", lastUpdate: "" } }));

    const list = getDriveMetadata({ fileStorage }, "folder-1");
    expect(list.map((m) => m.driveDataId).sort()).toEqual(["item-1", "item-2"]);
  });

  it("requires an existing saved item before update succeeds", () => {
    const cache = new InMemoryCacheRepository();
    const fileStorage = new InMemoryFileStorageRepository();
    const deps = { cache, fileStorage };

    const notSaved = updateDriveData(deps, makeDriveData());
    expect(notSaved.status).toBe("error");

    const added = addDriveData(deps, makeDriveData());
    const updated = updateDriveData(
      deps,
      makeDriveData({ metadata: { ...added.data!, driveDataId: "item-1" } })
    );
    expect(updated.status).toBe("success");
  });

  it("clears dedupe cache state keyed by the item id parsed from the file name on remove", () => {
    const cache = new InMemoryCacheRepository();
    const fileStorage = new InMemoryFileStorageRepository();
    const deps = { cache, fileStorage };

    const added = addDriveData(deps, makeDriveData());
    expect(cache.get("item-1")).toBe("saved");

    removeDriveData(deps, added.data!.fileId);
    expect(cache.get("item-1")).toBeNull();
  });
});
