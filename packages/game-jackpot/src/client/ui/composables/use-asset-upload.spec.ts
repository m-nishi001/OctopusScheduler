import { describe, it, expect, vi } from "vitest";
import { useAssetUpload } from "@ui/composables/use-asset-upload";

// Mock the dependencies
vi.mock("tsyringe", () => ({
  container: {
    resolve: vi.fn(),
  },
}));

vi.mock("@control/asset/asset-data-service", () => ({
  AssetDataService: vi.fn(),
}));

vi.mock("@ui/composables/use-object-url-store", () => ({
  useObjectUrlStore: vi.fn(() => ({
    createObjectUrl: vi.fn(() => "mock-url"),
    setUrl: vi.fn(),
  })),
}));

describe("useAssetUpload", () => {
  it("should upload asset and return assetId and url", async () => {
    const mockAsset = {
      id: "asset1",
      type: "image/png",
      name: "asset1.png",
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      size: 4,
      blob: new Blob(["test"]),
    };
    const mockUpdatedAsset = {
      id: "asset1",
      type: "image/png",
      name: "asset1.png",
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      size: 4,
      blob: null,
    } as any;

    const mockAssetDataService = {
      addAssetData: vi.fn().mockResolvedValue([mockUpdatedAsset]),
    };

    const { container } = await import("tsyringe");
    (container.resolve as any).mockReturnValue(mockAssetDataService);

    const { uploadAsset } = useAssetUpload();
    const result = await uploadAsset(mockAsset);

    expect(mockAssetDataService.addAssetData).toHaveBeenCalledWith([mockAsset]);
    expect(result).toEqual({ assetId: "asset1", url: "mock-url" });
  });
});
