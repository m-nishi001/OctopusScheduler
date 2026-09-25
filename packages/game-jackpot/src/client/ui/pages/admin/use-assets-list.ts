import { ref, computed } from "vue";
import { container } from "tsyringe";
import { AssetDataService } from "@control/asset/asset-data-service";
import type { Asset } from "@model/asset/asset-data";

export function useAssetsList(assetDataServiceArg?: AssetDataService) {
  const assetDataService = assetDataServiceArg || container.resolve(AssetDataService);

  const assets = ref<Asset[]>([]);
  const selectedAssets = ref<string[]>([]);
  const deleteAllDeleting = ref(false);
  const deleteAllMessage = ref("");

  const objectUrlMap = new Map<string, string>();

  const isAllSelected = computed({
    get: () => assets.value.length > 0 && selectedAssets.value.length === assets.value.length,
    set: (val: boolean) => {
      selectedAssets.value = val ? assets.value.map((a) => a.id) : [];
    },
  });

  const fetchAssets = async () => {
    assets.value = await assetDataService.getAllAssetData();
    for (const a of assets.value) {
      try {
        if (a.id && !objectUrlMap.has(a.id)) {
          objectUrlMap.set(a.id, URL.createObjectURL(a.blob));
        }
      } catch {
        /* ignore preview URL creation failures */
      }
    }
  };

  const deleteSelectedAssets = async () => {
    if (!selectedAssets.value.length) return;
    deleteAllDeleting.value = true;
    deleteAllMessage.value = "ファイル削除中...";
    const progressList = selectedAssets.value.map((id) => {
      const asset = assets.value.find((a) => a.id === id);
      return { id, name: asset?.name || id, status: "削除中" as "削除中" | "削除済" | "削除失敗" };
    });
    await assetDataService.deleteAssetData(selectedAssets.value, ({ id, success }) => {
      const item = progressList.find((p) => p.id === id);
      if (item) {
        item.status = success ? "削除済" : "削除失敗";
      }
      deleteAllMessage.value = `ファイル削除中...\n${progressList.map((p) => `${p.name}：${p.status}`).join("\n")}`;
      if (success) assets.value = assets.value.filter((a) => a.id !== id);
    });
    for (const id of selectedAssets.value) {
      const url = objectUrlMap.get(id);
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
        objectUrlMap.delete(id);
      }
    }
    deleteAllDeleting.value = false;
    selectedAssets.value = [];
  };

  const disposeObjectUrls = () => {
    for (const url of objectUrlMap.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    objectUrlMap.clear();
  };

  return {
    assets,
    selectedAssets,
    isAllSelected,
    deleteAllDeleting,
    deleteAllMessage,
    objectUrlMap,
    fetchAssets,
    deleteSelectedAssets,
    disposeObjectUrls,
  };
}
