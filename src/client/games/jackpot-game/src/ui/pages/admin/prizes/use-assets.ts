import { ref, computed, onBeforeUnmount, reactive } from "vue";
import { container } from "tsyringe";
import { AssetDataService } from "@model/applications/asset/asset-data-service";
import { useObjectUrlStore } from "@composables/prizes/use-object-url-store";

export function useAssets(assetDataServiceArg?: AssetDataService) {
  const assetDataService =
    assetDataServiceArg || container.resolve(AssetDataService);
  const assets = ref<any[]>([]);
  // Use the centralized object URL store
  const { objectUrlMap, createObjectUrl: createUrl, revokeAll } = useObjectUrlStore();

  const imageAssets = computed(() =>
    assets.value.filter((a) => a.blob?.type?.startsWith("image"))
  );
  const audioAssets = computed(() =>
    assets.value.filter((a) => a.blob?.type?.startsWith("audio"))
  );

  const fetchAssets = async () => {
    try {
      assets.value = await assetDataService.getAllAssetData();
    } catch (e) {
      console.error("Failed to fetch assets", e);
      assets.value = [];
    }
  };

  const createObjectUrl = (asset: any) => {
    if (!asset || !asset.id || !asset.blob) return;
    try {
      createUrl(asset.blob, asset.id);
    } catch (e) {
      console.warn("Failed to create object URL", e);
    }
  };

  const createObjectUrlById = async (assetId?: string) => {
    if (!assetId) return;
    try {
      const a = await assetDataService.getAssetDataById(assetId);
      if (a) createObjectUrl(a);
    } catch (e) {
      console.warn("Failed to fetch asset for object url:", e);
    }
  };

  const getObjectUrl = (id?: string) => (id ? objectUrlMap.get(id) : undefined);

  onBeforeUnmount(() => {
    revokeAll();
  });

  return {
    assets,
    imageAssets,
    audioAssets,
    fetchAssets,
    objectUrlMap,
    createObjectUrl,
    createObjectUrlById,
    getObjectUrl,
  };
}
