import { AssetDataService } from "@control/asset/asset-data-service";
import { container } from "tsyringe";
import { useObjectUrlStore } from "./use-object-url-store";
import type { Asset } from "@model/asset/asset-data";

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
      // For server-side assets we don't have a Blob; ensure store has an entry (empty for now)
      setUrl(updatedAsset.id, "");
      return { assetId: updatedAsset.id, url: "" };
    }
  }

  return {
    uploadAsset,
  };
}
