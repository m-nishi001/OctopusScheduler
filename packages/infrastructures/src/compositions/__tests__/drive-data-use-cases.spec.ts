import { describe, it, expect } from "vitest";
import { InMemoryCache } from "../../testing/in-memory-cache";
import { InMemoryKeyValueStorage } from "../../testing/in-memory-key-value-storage";
import { addDriveData } from "../add-item-use-case";
import { getDriveData } from "../get-item-use-case";
import { getDriveMetadata } from "../get-item-metadata-use-case";
import { updateDriveData } from "../update-item-use-case";
import { removeDriveData } from "../remove-item-use-case";
import type { DriveData } from "../types";

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
  it("adds a new drive data item, then rejects a duplicate add", async () => {
    const cache = new InMemoryCache();
    const storage = new InMemoryKeyValueStorage();
    const deps = { cache, storage };

    const first = await addDriveData(deps, makeDriveData());
    expect(first.status).toBe("success");
    expect(first.data?.driveDataId).toBe("item-1");

    const second = await addDriveData(deps, makeDriveData());
    expect(second.status).toBe("duplicate");
  });

  it("round-trips content through getDriveData", async () => {
    const cache = new InMemoryCache();
    const storage = new InMemoryKeyValueStorage();
    const deps = { cache, storage };

    const added = await addDriveData(deps, makeDriveData());
    const fileId = added.data!.fileId;

    const fetched = await getDriveData({ storage }, fileId);
    expect(fetched).not.toBeNull();
    expect(fetched!.fileName).toBe("photo.png");
    expect(fetched!.metadata.driveDataId).toBe("item-1");
    expect(fetched!.fileDataUrl).toContain("base64,");
  });

  it("lists metadata for a folder", async () => {
    const cache = new InMemoryCache();
    const storage = new InMemoryKeyValueStorage();
    const deps = { cache, storage };

    await addDriveData(deps, makeDriveData());
    await addDriveData(deps, makeDriveData({ metadata: { driveDataId: "item-2", fileId: "", parentFolderId: "folder-1", lastUpdate: "" } }));

    const list = await getDriveMetadata({ storage }, "folder-1");
    expect(list.map((m) => m.driveDataId).sort()).toEqual(["item-1", "item-2"]);
  });

  it("requires an existing saved item before update succeeds", async () => {
    const cache = new InMemoryCache();
    const storage = new InMemoryKeyValueStorage();
    const deps = { cache, storage };

    const notSaved = await updateDriveData(deps, makeDriveData());
    expect(notSaved.status).toBe("error");

    const added = await addDriveData(deps, makeDriveData());
    const updated = await updateDriveData(
      deps,
      makeDriveData({ metadata: { ...added.data!, driveDataId: "item-1" } })
    );
    expect(updated.status).toBe("success");
  });

  it("clears dedupe cache state keyed by the item id parsed from the key on remove", async () => {
    const cache = new InMemoryCache();
    const storage = new InMemoryKeyValueStorage();
    const deps = { cache, storage };

    const added = await addDriveData(deps, makeDriveData());
    expect(await cache.get("item-1")).toBe("saved");

    await removeDriveData(deps, added.data!.fileId);
    expect(await cache.get("item-1")).toBeNull();
  });
});
