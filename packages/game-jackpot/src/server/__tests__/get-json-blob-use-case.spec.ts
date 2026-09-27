import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { addJsonBlob } from "../add-json-blob-use-case";
import { getJsonBlob } from "../get-json-blob-use-case";

async function makeConfiguredStorage(): Promise<InMemoryKeyValueStorage> {
  const storage = new InMemoryKeyValueStorage();
  // 本番ではGASのScriptPropertiesで設定される、JSON blobの保存先フォルダ。
  await storage.set("jackpot-game-json-folder", "folder1");
  return storage;
}

describe("getJsonBlob", () => {
  it("returns an empty array with a null updatedAt when nothing has ever been written", async () => {
    const storage = await makeConfiguredStorage();
    const result = await getJsonBlob({ storage });
    expect(JSON.parse(result.json)).toEqual([]);
    expect(result.updatedAt).toBeNull();
  });

  it("resolves the default file (prizes.json) and returns its updatedAt when no fileId is given", async () => {
    const storage = await makeConfiguredStorage();
    await addJsonBlob(
      { storage },
      {
        metadata: {} as any,
        fileName: "prizes.json",
        jsonText: JSON.stringify([{ id: "p1" }]),
        uploadDate: "",
        parentFolderId: "",
      }
    );

    const result = await getJsonBlob({ storage });

    expect(JSON.parse(result.json)).toEqual([{ id: "p1" }]);
    expect(result.updatedAt).not.toBeNull();
  });

  it("resolves by the exact fileId returned from a previous addJsonBlob and returns its updatedAt", async () => {
    const storage = await makeConfiguredStorage();
    const added = await addJsonBlob(
      { storage },
      {
        appFileId: "screens",
        metadata: {} as any,
        fileName: "screens.json",
        jsonText: JSON.stringify([{ screenName: "home" }]),
        uploadDate: "",
        parentFolderId: "",
      }
    );

    const result = await getJsonBlob({ storage }, added.fileId);

    expect(JSON.parse(result.json)).toEqual([{ screenName: "home" }]);
    expect(result.updatedAt).toBe(added.lastUpdate);
  });
});
