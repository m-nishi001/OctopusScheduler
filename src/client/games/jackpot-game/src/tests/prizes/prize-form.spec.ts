import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import PrizeForm from "../../ui/components/prizes/prize-form.vue";
import { container } from "tsyringe";
import { IdGeneratorToken } from "../../model/domains/common/id-generator";
import { AssetDataService } from "@model/applications/asset/asset-data-service";

// Mock dependencies
vi.mock("@composables/prizes/use-object-url-store");
vi.mock("@composables/prizes/use-asset-upload");

const mockUseObjectUrlStore = vi.fn(() => ({
  objectUrlMap: new Map(),
  createObjectUrl: vi.fn(),
  revoke: vi.fn(),
}));

const mockUseAssetUpload = vi.fn(() => ({
  uploadAsset: vi.fn(),
}));

vi.mocked(
  await import("@composables/prizes/use-object-url-store")
).useObjectUrlStore = mockUseObjectUrlStore;
vi.mocked(await import("@composables/prizes/use-asset-upload")).useAssetUpload =
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
    container.register(IdGeneratorToken, { useValue: mockIdGenerator });

    // Mock AssetDataService
    container.register(AssetDataService, { useValue: mockAssetDataService });
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
    expect(wrapper.text()).toContain("当選景品画像1");
    expect(wrapper.text()).toContain("当選景品画像2");
  });
});
