import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { ScreenConfig } from "../../domains/screen-config/screen-config";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/IScreenConfigRepository";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";

@injectable()
export class ScreenConfigRepository implements IScreenConfigRepository {
  private cache: Map<string, ScreenConfig> = new Map();
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScreenConfigData")
  );
  private readonly gasService = GasFunctionService.create("callJackpotGameApi");

  async getScreenConfigs(): Promise<ScreenConfig[]> {
    const all = await this.localStorage.getAll<ScreenConfig>();
    return Array.from(all.values()).filter((v) => v.type);
  }

  async getScreenConfigById(type: string): Promise<ScreenConfig | null> {
    const fromCache = this.cache.get(type);
    if (fromCache) return fromCache;

    const fromLocal = await this.loadFromLocal(type);
    if (fromLocal) return fromLocal;

    return null; // 同期関数でサーバーから取得
  }

  async updateScreenConfigs(configs: ScreenConfig[]): Promise<void> {
    for (const config of configs) {
      await this.localStorage.save(`screen_${config.type}`, config);
      this.cache.set(config.type, config);
    }
    if (this.gasService) {
      try {
        await this.saveToGas(configs);
      } catch (e) {
        console.warn("Failed to save to GAS:", e);
      }
    }
  }

  async deleteScreenConfigs(types: string[]): Promise<void> {
    for (const type of types) {
      await this.localStorage.remove(`screen_${type}`);
      this.cache.delete(type);
    }
    if (this.gasService) {
      try {
        await this.deleteFromGas(types);
      } catch (e) {
        console.warn("Failed to delete from GAS:", e);
      }
    }
  }

  async addScreenConfigs(configs: ScreenConfig[]): Promise<void> {
    await this.updateScreenConfigs(configs);
  }

  async syncScreenConfigs(): Promise<void> {
    if (!this.gasService) throw new Error("GAS service not available");
    // サーバーから全画面設定を取得
    const allTypes: string[] = [
      "home",
      "opening",
      "description",
      "demo",
      "main",
      "result",
      "admin",
    ]; // 仮定
    const promises = allTypes.map(async (type) => {
      try {
        const dto = await new Promise<ScreenConfig | null>(
          (resolve, reject) => {
            this.gasService!.createCall<any>(
              "ScreenConfigService.getScreenConfig",
              { id: type }
            )
              .withSuccessed((res: any) => resolve(res ? res : null))
              .withFailuered((msg: string) => reject(new Error(msg)))
              .invoke();
          }
        );
        if (dto) {
          this.cache.set(type, dto);
          await this.localStorage.save(`screen_${type}`, dto);
        }
      } catch (e) {
        console.warn(`Failed to sync screen config for ${type}:`, e);
      }
    });
    await Promise.all(promises);
  }

  private async loadFromLocal(type: string): Promise<ScreenConfig | undefined> {
    try {
      const stored = await this.localStorage.get<ScreenConfig>(
        `screen_${type}`
      );
      if (stored) {
        this.cache.set(type, stored);
        return stored;
      }
    } catch (e) {
      console.warn(
        `Failed to load screen config from storage for type '${type}':`,
        e
      );
    }
    return undefined;
  }

  private async saveToGas(configs: ScreenConfig[]): Promise<void> {
    if (!this.gasService) return;
    const promises = configs.map(
      (config) =>
        new Promise<void>((resolve, reject) => {
          this.gasService!.createCall<void>(
            "ScreenConfigService.updateScreenConfig",
            config
          )
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        })
    );
    await Promise.all(promises);
  }

  private async deleteFromGas(types: string[]): Promise<void> {
    if (!this.gasService) return;
    const promises = types.map(
      (type) =>
        new Promise<void>((resolve, reject) => {
          this.gasService!.createCall<void>(
            "ScreenConfigService.deleteScreenConfig",
            { type }
          )
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        })
    );
    await Promise.all(promises);
  }
}
