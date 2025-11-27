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

  it("submits form data with uploaded asset IDs", async () => {
    const mockUploadAsset = vi.fn();
    mockUploadAsset.mockResolvedValueOnce({ assetId: "asset1", url: "url1" }); // image1
    mockUploadAsset.mockResolvedValueOnce({ assetId: "asset2", url: "url2" }); // image2

    mockUseAssetUpload.mockReturnValue({ uploadAsset: mockUploadAsset });

    const wrapper = mount(PrizeForm, {
      props: {
        mode: "add",
        imageAssets: [],
        audioAssets: [],
      },
    });

    // Simulate form data
    await wrapper.vm.$nextTick();
    wrapper.vm.formData.name = "Test Prize";
    wrapper.vm.formData.rank = 1;

    // Simulate file uploads
    const file1 = new Blob(["test1"], { type: "image/png" });
    const file2 = new Blob(["test2"], { type: "image/png" });
    await wrapper.vm.onImage1Change({ target: { files: [file1] } });
    await wrapper.vm.onImage2Change({ target: { files: [file2] } });

    // Trigger submit directly
    console.log("tempAsset1:", wrapper.vm.tempAsset1);
    console.log("tempAsset2:", wrapper.vm.tempAsset2);
    await wrapper.vm.submit();

    // Check that uploadAsset was called
    expect(mockUploadAsset).toHaveBeenCalledTimes(2);

    // Check emitted data
    expect(wrapper.emitted("submit")).toBeTruthy();
    const emittedData = wrapper.emitted("submit")[0][0];
    expect(emittedData.imageAssetId).toBe("asset1");
    expect(emittedData.image2AssetId).toBe("asset2");
  });
});
