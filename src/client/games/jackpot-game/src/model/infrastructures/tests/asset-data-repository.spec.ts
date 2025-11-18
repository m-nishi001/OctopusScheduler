import { describe, it, expect, beforeEach, vi } from "vitest";
import { AssetDataRepository } from "../asset-data-repository";
import { Asset } from "../../domains/drive-data/asset-data";

describe("AssetDataRepository", () => {
  let repo: AssetDataRepository;

  beforeEach(() => {
    repo = new AssetDataRepository();
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
