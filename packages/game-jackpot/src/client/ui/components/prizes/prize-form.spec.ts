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

  it("exposes a weight field (not the removed rank field) defaulted for a new prize", () => {
    const wrapper = mount(PrizeForm, {
      props: {
        mode: "add",
        imageAssets: [],
        audioAssets: [],
      },
    });

    expect(wrapper.text()).toContain("当選確率の重み");
    expect(wrapper.text()).not.toContain("景品ランク");
    const input = wrapper.find('input[type="number"]');
    expect(input.exists()).toBe(true);
    expect((input.element as HTMLInputElement).value).toBe("10");
  });

  it("loads an existing prize's weight when editing", () => {
    const wrapper = mount(PrizeForm, {
      props: {
        mode: "edit",
        prize: { name: "Grand Prize", weight: 80 },
        imageAssets: [],
        audioAssets: [],
      },
    });

    const input = wrapper.find('input[type="number"]');
    expect((input.element as HTMLInputElement).value).toBe("80");
  });

  describe("odds preview", () => {
    it("computes the win probability against the other prizes in the pool", () => {
      const wrapper = mount(PrizeForm, {
        props: {
          mode: "add",
          imageAssets: [],
          audioAssets: [],
          otherPrizes: [
            { id: "p1", name: "A", weight: 90, order: 1 },
          ],
        },
      });

      // new prize defaults to weight 10 -> total = 90 + 10 = 100 -> 10.0%
      expect(wrapper.text()).toContain("約10.0%");
    });

    it("excludes the prize being edited from its own odds calculation", () => {
      const wrapper = mount(PrizeForm, {
        props: {
          mode: "edit",
          prize: { id: "p1", name: "Grand Prize", weight: 50 },
          imageAssets: [],
          audioAssets: [],
          otherPrizes: [
            { id: "p1", name: "Grand Prize", weight: 50, order: 1 },
            { id: "p2", name: "B", weight: 50, order: 2 },
          ],
        },
      });

      // p1 (self, excluded from "others") weight 50 vs p2 weight 50 -> total 100 -> 50.0%
      expect(wrapper.text()).toContain("約50.0%");
    });
  });
});
