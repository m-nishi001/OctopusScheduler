import { AssetDataService } from "@model/applications/asset/asset-data-service";
import { container } from "tsyringe";
import { useObjectUrlStore } from "./use-object-url-store";
import type { Asset } from "@model/domains/drive-data/asset-data";

export function useAssetUpload() {
  const assetDataService = container.resolve(AssetDataService);
  const { createObjectUrl, setUrl } = useObjectUrlStore();

  async function uploadAsset(
    asset: Asset
  ): Promise<{ assetId: string; url: string }> {
    const updatedAssets = await assetDataService.addAssetData([asset]);
    const updatedAsset = updatedAssets[0];
    // Assuming asset.blob exists for object URL
    if (asset.blob) {
      const url = createObjectUrl(asset.blob, updatedAsset.id);
      return { assetId: updatedAsset.id, url };
    } else {
      // For server URLs, set directly
      setUrl(updatedAsset.id, updatedAsset.url || "");
      return { assetId: updatedAsset.id, url: updatedAsset.url || "" };
    }
  }

  return {
    uploadAsset,
  };
}
