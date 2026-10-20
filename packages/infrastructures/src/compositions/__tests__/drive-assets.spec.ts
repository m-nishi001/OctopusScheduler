import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "../../testing/in-memory-key-value-storage";
import { createDriveAssets } from "../drive-assets";
import { StorageKind, StorageModule } from "../storage-paths";
import type { DriveData } from "../types";

const NAMESPACE = "quiz-game/assets";
const assets = createDriveAssets(StorageModule.Quiz, StorageKind.Assets);

/** クライアントが送る形。fileId は空(更新でも、保存先のキーはサーバーが決める)。 */
function makeDriveData(overrides: Partial<DriveData> = {}, id = "item-1"): DriveData {
  return {
    metadata: { driveDataId: id, fileId: "", parentFolderId: "client-supplied", lastUpdate: "" },
    fileName: "photo.png",
    fileKind: "image/png",
    fileDataUrl: `data:image/png;base64,${Buffer.from("hello").toString("base64")}`,
    uploadDate: "",
    parentFolderId: "client-supplied",
    ...overrides,
  };
}

const withBody = (text: string) => ({
  fileDataUrl: `data:image/png;base64,${Buffer.from(text).toString("base64")}`,
});

describe("素材の保存(追加・更新)", () => {
  it("保存先はクライアントの parentFolderId に関わらず、置き場に固定する", async () => {
    const deps = { storage: new InMemoryKeyValueStorage() };
    const saved = await assets.save(deps, makeDriveData());
    expect(saved.fileId.startsWith(`${NAMESPACE}/`)).toBe(true);
    expect(saved.parentFolderId).toBe(NAMESPACE);
    expect(saved.driveDataId).toBe("item-1");
  });

  it("保存済みの素材を、保存の履歴(キャッシュ)なしでも更新できる(fileId が空でも失敗しない)", async () => {
    const deps = { storage: new InMemoryKeyValueStorage() };
    await assets.save(deps, makeDriveData(withBody("v1")));

    // 以前は「キャッシュに saved が無い」「fileId が空」のどちらでも更新が捨てられていた
    await assets.save(deps, makeDriveData(withBody("v2")));

    const list = await assets.listMetadata(deps);
    expect(list).toHaveLength(1);
    const fetched = await assets.get(deps, list[0].fileId);
    expect(Buffer.from(fetched!.fileDataUrl.split("base64,")[1], "base64").toString()).toBe("v2");
  });

  it("同じ内容を続けて保存しても、1件のまま(重複しても失敗しない)", async () => {
    const deps = { storage: new InMemoryKeyValueStorage() };
    await assets.save(deps, makeDriveData());
    await assets.save(deps, makeDriveData());
    expect(await assets.listMetadata(deps)).toHaveLength(1);
  });

  it("表示名を変えて保存すると、古い名前のキーは残らない", async () => {
    const deps = { storage: new InMemoryKeyValueStorage() };
    await assets.save(deps, makeDriveData({ fileName: "old.png" }));
    const renamed = await assets.save(deps, makeDriveData({ fileName: "new.png" }));

    const list = await assets.listMetadata(deps);
    expect(list.map((m) => m.fileId)).toEqual([renamed.fileId]);
    expect((await assets.get(deps, renamed.fileId))!.fileName).toBe("new.png");
  });

  it("別の素材には影響しない", async () => {
    const deps = { storage: new InMemoryKeyValueStorage() };
    await assets.save(deps, makeDriveData({}, "item-1"));
    await assets.save(deps, makeDriveData({}, "item-2"));
    await assets.save(deps, makeDriveData({ fileName: "renamed.png" }, "item-1"));

    const list = await assets.listMetadata(deps);
    expect(list.map((m) => m.driveDataId).sort()).toEqual(["item-1", "item-2"]);
  });

  it("書き込みに失敗したら、成功にせず例外で伝え、古い内容は消さない", async () => {
    const storage = new InMemoryKeyValueStorage();
    const deps = { storage };
    await assets.save(deps, makeDriveData({ fileName: "old.png" }));

    storage.putBinary = async () => {
      throw new Error("R2 down");
    };
    await expect(assets.save(deps, makeDriveData({ fileName: "new.png" }))).rejects.toThrow("R2 down");

    const list = await assets.listMetadata(deps);
    expect(list).toHaveLength(1);
    expect((await assets.get(deps, list[0].fileId))!.fileName).toBe("old.png");
  });
});

describe("素材の取得・一覧", () => {
  it("保存した内容をそのまま取り出せる", async () => {
    const deps = { storage: new InMemoryKeyValueStorage() };
    const saved = await assets.save(deps, makeDriveData());
    const fetched = await assets.get(deps, saved.fileId);
    expect(fetched!.fileName).toBe("photo.png");
    expect(fetched!.metadata.driveDataId).toBe("item-1");
    expect(fetched!.fileDataUrl).toContain("base64,");
  });

  it("無い素材は null", async () => {
    const deps = { storage: new InMemoryKeyValueStorage() };
    expect(await assets.get(deps, `${NAMESPACE}/missing_x.png`)).toBeNull();
  });

  it("読み取りに失敗したら null にせず例外で伝える(「無い」と取り違えて空で上書きしないため)", async () => {
    const storage = new InMemoryKeyValueStorage();
    storage.getContent = async () => {
      throw new Error("R2 down");
    };
    await expect(assets.get({ storage }, `${NAMESPACE}/a_b.png`)).rejects.toThrow("R2 down");
  });

  it("サブフォルダ名を渡すと、置き場直下のそのフォルダを一覧する", async () => {
    const storage = new InMemoryKeyValueStorage();
    await storage.putBinary(`${NAMESPACE}/show1/b.png`, "eA==", "image/png");
    expect((await assets.listMetadata({ storage }, " show1 ")).map((m) => m.fileId)).toEqual([`${NAMESPACE}/show1/b.png`]);
  });

  it("フォルダ名が1階層のパス要素でなければ例外", async () => {
    await expect(assets.listMetadata({ storage: new InMemoryKeyValueStorage() }, "../x")).rejects.toThrow(/Invalid storage path/);
  });
});
