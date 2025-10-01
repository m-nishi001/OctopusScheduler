import { injectable } from "tsyringe";
import type { ScreenConfig } from "../../domains/screen-config/screen-config";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/IScreenConfigRepository";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../../infrastructures/storage-config";

@injectable()
export class ScreenConfigRepository implements IScreenConfigRepository {
  private cache: Map<string, ScreenConfig> = new Map();
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScreenConfigData")
  );

  // 画面設定を取得
  async fetchScreenConfig(type: string): Promise<ScreenConfig> {
    const config = this.cache.get(type);
    if (!config) {
      throw new Error(`Screen config for type '${type}' not found`);
    }
    return config;
  }

  // 差分更新保存
  async saveScreenConfigs(newConfigs: ScreenConfig[]): Promise<void> {
    for (const config of newConfigs) {
      const prev = this.cache.get(config.type);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(config)) {
        await this.localStorage.save(`screen_${config.type}`, config);
        this.cache.set(config.type, config);
      }
    }
  }

  // 初期化（localStorageからロード）
  async loadAllFromStorage(types: string[]): Promise<void> {
    for (const type of types) {
      const obj = await this.localStorage.get<ScreenConfig>(`screen_${type}`);
      if (obj) {
        this.cache.set(type, obj);
      }
    }
  }
}
