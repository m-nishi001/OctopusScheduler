import { injectable, inject } from "tsyringe";
import { eventBus } from "@octopus/client-common/events/event-bus";
import type { Asset } from "../../model/asset/asset";
import { AssetRepository } from "../../model/asset/asset-repository";

/**
 * 素材(画像・音声・動画)の追加・取得・削除。
 * 追加と削除のあとは、一覧を開いている画面へ `assets:updated` を知らせ、バックグラウンド同期にも変更を伝える。
 */
@injectable()
export class AssetService {
  constructor(@inject(AssetRepository) private assetRepository: AssetRepository) {}

  async addAssets(assets: Asset[]): Promise<string[]> {
    const ids = await this.assetRepository.addAssets(assets);
    try {
      // notify other interested components that assets changed
      if (typeof window !== "undefined" && (window as any).dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent("assets:updated", { detail: { added: ids } })
        );
      }
    } catch (e) {
      // ignore
    }
    eventBus.emit("syncDirty");
    return ids;
  }

  async getAssets(): Promise<Asset[]> {
    return await this.assetRepository.getAssets();
  }

  async getAssetById(id: string): Promise<Asset | null> {
    return await this.assetRepository.getAssetById(id);
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.assetRepository.deleteAssets(ids);
    try {
      if (typeof window !== "undefined" && (window as any).dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent("assets:updated", { detail: { deleted: ids } })
        );
      }
    } catch (e) {
      // ignore
    }
    eventBus.emit("syncDirty");
  }
}
