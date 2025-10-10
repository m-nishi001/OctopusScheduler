import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import type { ScreenConfig } from "../../domains/screen-config/screen-config";
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

  async fetchScreenConfig(type: string): Promise<ScreenConfig> {
    const fromCache = this.cache.get(type);
    if (fromCache) return fromCache;

    const fromLocal = await this.loadFromLocal(type);
    if (fromLocal) return fromLocal;

    const fromServer = await this.fetchFromGas(type);
    if (fromServer === null) {
      await this.removeLocalCopy(type);
      const def = this.createDefaultConfig(type);
      this.cache.set(type, def);
      return def;
    }
    if (fromServer) {
      this.cache.set(type, fromServer);
      await this.localStorage.save(`screen_${type}`, fromServer);
      return fromServer;
    }

    const fallback = this.createDefaultConfig(type);
    this.cache.set(type, fallback);
    await this.localStorage.save(`screen_${type}`, fallback);
    return fallback;
  }

  async saveScreenConfigs(newConfigs: ScreenConfig[]): Promise<void> {
    const toSave = this.determineToSave(newConfigs);
    if (toSave.length === 0) return;

    if (this.gasService) {
      try {
        await this.saveToGasParallel(toSave);
        return;
      } catch (e) {
        console.warn(
          "GAS parallel save failed, falling back to per-item local save:",
          e
        );
      }
    }

    await this.saveLocallyForConfigs(toSave);
  }

  async syncScreenConfigs(): Promise<void> {
    if (this.gasService) {
      try {
        const serverMap = await this.fetchAllFromGas();
        await this.persistServerConfigs(serverMap);
        await this.pruneLocalNotOnServer(serverMap);
        return;
      } catch (e) {
        console.warn(
          "Failed to load configs from GAS, falling back to local storage:",
          e
        );
      }
    }

    await this.loadAllFromLocal();
  }

  private createDefaultConfig(type: string): ScreenConfig {
    return {
      type: type as ScreenConfig["type"],
      bgmAssetId: undefined,
      seAssetIds: [],
      backgroundStyle: "",
      elements: [],
    };
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

  private async fetchFromGas(
    type: string
  ): Promise<ScreenConfig | null | undefined> {
    if (!this.gasService) return undefined;
    try {
      const dto = await new Promise<ScreenConfig | null>((resolve, reject) => {
        this.gasService!.createCall<any>("ScreenConfigService.findByType", {
          type,
        })
          .withSuccessed((res: any) =>
            resolve(res ? (res as ScreenConfig) : null)
          )
          .withFailuered((msg: string) => reject(new Error(msg)))
          .invoke();
      });
      return dto;
    } catch (e) {
      console.warn("Failed to fetch screen config from GAS:", e);
      return undefined;
    }
  }

  private async removeLocalCopy(type: string): Promise<void> {
    try {
      await this.localStorage.remove(`screen_${type}`);
    } catch (e) {
      console.warn(
        `Failed to remove local screen config for type '${type}':`,
        e
      );
    }
    this.cache.delete(type);
  }

  private determineToSave(newConfigs: ScreenConfig[]): ScreenConfig[] {
    return newConfigs.filter((config) => {
      const prev = this.cache.get(config.type);
      return !prev || JSON.stringify(prev) !== JSON.stringify(config);
    });
  }

  private async saveToGasParallel(configs: ScreenConfig[]): Promise<void> {
    const creates = configs.filter((c) => !c.id);
    const updates = configs.filter((c) => c.id);

    const promises: Promise<void>[] = [];

    if (creates.length > 0) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          this.gasService!.createCall<void>(
            "ScreenConfigService.createScreenConfigs",
            {
              configs: creates,
            }
          )
            .withTimeout(120000)
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        })
      );
    }

    if (updates.length > 0) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          this.gasService!.createCall<void>(
            "ScreenConfigService.updateScreenConfigs",
            {
              configs: updates,
            }
          )
            .withTimeout(120000)
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        })
      );
    }

    await Promise.all(promises);
  }

  private async saveLocallyForConfigs(configs: ScreenConfig[]): Promise<void> {
    for (const config of configs) {
      await this.localStorage.save(`screen_${config.type}`, config);
      this.cache.set(config.type, config);
    }
  }

  private async fetchAllFromGas(): Promise<Map<string, any>> {
    const map = new Map<string, any>();
    if (!this.gasService) return map;
    const res = await new Promise<any[]>((resolve, reject) => {
      this.gasService!.createCall<any[]>("ScreenConfigService.findAll")
        .withSuccessed((r: any) => resolve(r || []))
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
    for (const cfg of res) if (cfg && cfg.type) map.set(cfg.type, cfg);
    return map;
  }

  private async persistServerConfigs(
    serverMap: Map<string, any>
  ): Promise<void> {
    const savePromises: Promise<void>[] = [];
    for (const [type, cfg] of serverMap.entries()) {
      savePromises.push(this.localStorage.save(`screen_${type}`, cfg));
      this.cache.set(type, cfg);
    }
    await Promise.all(savePromises);
  }

  private async pruneLocalNotOnServer(
    serverMap: Map<string, any>
  ): Promise<void> {
    try {
      const allLocal = await this.localStorage.getAll<ScreenConfig>();
      const toRemove: string[] = [];
      for (const key of allLocal.keys()) {
        if (key.startsWith("screen_")) {
          const type = key.substring("screen_".length);
          if (!serverMap.has(type)) toRemove.push(key);
        }
      }
      if (toRemove.length > 0) {
        await this.localStorage.removeMultiple(toRemove);
        for (const k of toRemove)
          this.cache.delete(k.substring("screen_".length));
      }
    } catch (e) {
      console.warn("Failed to prune local storage after server sync:", e);
    }
  }

  private async loadAllFromLocal(): Promise<void> {
    try {
      const all = await this.localStorage.getAll<ScreenConfig>();
      for (const [key, val] of all.entries()) {
        if (key.startsWith("screen_")) {
          const type = key.substring("screen_".length);
          this.cache.set(type, val);
        }
      }
    } catch (e) {
      console.warn("Failed to load screen configs from local storage:", e);
    }
  }
}
