import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import PrizeForm from "./prize-form.vue";
import { container } from "tsyringe";
import { CryptoIdGenerator } from "../../../model/common/crypto-id-generator";
import { AssetDataService } from "@control/asset/asset-data-service";

// Mock dependencies
vi.mock("@ui/composables/use-object-url-store");
vi.mock("@ui/composables/use-asset-upload");

const mockUseObjectUrlStore = vi.fn(() => ({
  objectUrlMap: new Map<string, string>(),
  createObjectUrl: vi.fn(),
  setUrl: vi.fn(),
  getUrl: vi.fn(),
  revoke: vi.fn(),
  revokeAll: vi.fn(),
}));

const mockUseAssetUpload = vi.fn(() => ({
  uploadAsset: vi.fn(),
}));

vi.mocked(
  await import("@ui/composables/use-object-url-store")
).useObjectUrlStore = mockUseObjectUrlStore;
vi.mocked(await import("@ui/composables/use-asset-upload")).useAssetUpload =
  mockUseAssetUpload;

const mockAssetDataService = {
  createDriveDataDtoFromFile: vi.fn((file) => ({ id: "asset-id", blob: file })),
};

describe("PrizeForm", () => {
  beforeEach(() => {
    container.reset();
    // Mock IdGenerator for AssetDataRepository
    const mockIdGenerator = {
      nextId: vi.fn(() => "generated-id"),
    };
    container.register(CryptoIdGenerator, { useValue: mockIdGenerator });

    // Mock AssetDataService
    container.registerInstance(AssetDataService, mockAssetDataService as any);
  });
  it("renders correctly", () => {
    const wrapper = mount(PrizeForm, {
      props: {
        mode: "add",
        imageAssets: [],
        audioAssets: [],
      },
    });
    expect(wrapper.exists()).toBe(true);
  });

  it("has new winning image fields", async () => {
    const wrapper = mount(PrizeForm, {
      props: {
        mode: "add",
        imageAssets: [],
        audioAssets: [],
      },
    });

    // Check that form renders new fields
    expect(wrapper.text()).toContain("当選画像1");
    expect(wrapper.text()).toContain("当選画像2");
  });
});
