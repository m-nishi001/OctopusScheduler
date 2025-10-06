import { ref, computed } from "vue";
import { container } from "tsyringe";
import { AssetService } from "../../../model/applications/asset-service";

export function useAssets() {
  const assetService = container.resolve(
    AssetService
  ) as unknown as AssetService;

  const assets = ref<any[]>([]);

  const fetchAssets = async () => {
    try {
      assets.value = await assetService.fetchAssets();
    } catch (error) {
      console.error("Failed to fetch assets:", error);
      assets.value = [];
    }
  };

  const syncWithDrive = async (onMessage?: (msg: string) => void) => {
    try {
      await assetService.syncAssetsWithGoogleDrive((message: string) => {
        if (onMessage) onMessage(message);
      });
    } catch (e) {
      console.error("syncAssetsWithGoogleDrive failed", e);
    }
  };

  const audioAssets = computed(() =>
    assets.value.filter((a) => a.type === "audio")
  );
  const imageAssets = computed(() =>
    assets.value.filter((a) => a.type === "image")
  );

  return {
    assets,
    assetService,
    fetchAssets,
    syncWithDrive,
    audioAssets,
    imageAssets,
  } as const;
}
