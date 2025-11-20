import { ref, computed, onBeforeUnmount, reactive } from "vue";
import { container } from "tsyringe";
import { AssetDataService } from "@model/applications/asset/asset-data-service";

export function useAssets(assetDataServiceArg?: AssetDataService) {
  const assetDataService =
    assetDataServiceArg || container.resolve(AssetDataService);
  const assets = ref<any[]>([]);
  // make the map reactive so template bindings like `objectUrlMap.get(id)` update
  // when entries are added/removed. Vue's `reactive` supports Map proxies.
  const objectUrlMap = reactive(new Map<string, string>());

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
      const url = URL.createObjectURL(asset.blob);
      if (objectUrlMap.has(asset.id)) {
        try {
          URL.revokeObjectURL(objectUrlMap.get(asset.id) as string);
        } catch {}
      }
      objectUrlMap.set(asset.id, url);
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
    try {
      objectUrlMap.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      objectUrlMap.clear();
    } catch {}
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
