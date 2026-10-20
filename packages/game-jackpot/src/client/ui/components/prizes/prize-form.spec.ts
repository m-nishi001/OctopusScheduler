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

  describe("submit", () => {
    it("選んだ素材をアップロードして、欄ごとの項目に id を入れて送る(選んでいない欄は変えない)", async () => {
      const uploadAsset = vi.fn(async (asset: { id: string }) => ({ assetId: `up-${asset.id}` }));
      mockUseAssetUpload.mockReturnValueOnce({ uploadAsset });
      mockAssetDataService.createDriveDataDtoFromFile.mockImplementation((file: File) => ({ id: `id-${file.name}`, blob: file }) as never);

      const wrapper = mount(PrizeForm, {
        props: { mode: "edit", prize: { id: "p1", name: "賞", bgm2AssetId: "keep-bgm2" }, imageAssets: [], audioAssets: [] },
      });
      const fileEvent = (name: string) => ({ target: { files: [new File(["x"], name)] } });
      const images = wrapper.findAllComponents({ name: "ImageField" });
      const bgms = wrapper.findAllComponents({ name: "BgmField" });
      expect(images).toHaveLength(4);
      expect(bgms).toHaveLength(2);

      images[0].vm.$emit("file-change", fileEvent("main.png"));
      images[3].vm.$emit("file-change", fileEvent("win2.png"));
      bgms[0].vm.$emit("file-change", fileEvent("bgm1.mp3"));
      await new Promise((r) => setTimeout(r, 0));

      await (wrapper.vm as unknown as { submit: () => Promise<void> }).submit();

      expect(uploadAsset).toHaveBeenCalledTimes(3);
      const [submitted] = wrapper.emitted("submit")![0] as [Record<string, string>];
      expect(submitted).toMatchObject({
        name: "賞",
        imageAssetId: "up-id-main.png",
        winningImage2AssetId: "up-id-win2.png",
        bgm1AssetId: "up-id-bgm1.mp3",
        bgm2AssetId: "keep-bgm2",
        image2AssetId: "",
      });
    });

    it("名前が空なら送らない", async () => {
      const wrapper = mount(PrizeForm, { props: { mode: "add", imageAssets: [], audioAssets: [] } });
      await (wrapper.vm as unknown as { submit: () => Promise<void> }).submit();
      expect(wrapper.emitted("submit")).toBeUndefined();
    });
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
