import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { ScreenSettings } from "../../../../../../packages/common-lib/src/screen-settings";
import type { IScreenConfig } from "../../domains/screen-config/IScreenConfig";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/IScreenConfigRepository";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { HomeScreenConfig } from "../../domains/screen-config/HomeScreenConfig";
import { OpeningScreenConfig } from "../../domains/screen-config/OpeningScreenConfig";
import { DescriptionScreenConfig } from "../../domains/screen-config/DescriptionScreenConfig";
import { DemoScreenConfig } from "../../domains/screen-config/DemoScreenConfig";
import { MainScreenConfig } from "../../domains/screen-config/MainScreenConfig";
import { ResultScreenConfig } from "../../domains/screen-config/ResultScreenConfig";
import { EndingScreenConfig } from "../../domains/screen-config/EndingScreenConfig";

@injectable()
export class ScreenConfigRepository implements IScreenConfigRepository {
  private cache: Map<string, IScreenConfig> = new Map();
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScreenConfigData")
  );
  private readonly gasService = GasFunctionService.create("callJackpotGameApi");

  async getScreenConfigs(): Promise<IScreenConfig[]> {
    const all = await this.localStorage.getAll<IScreenConfig>();
    return Array.from(all.values()).filter((v) => v.type);
  }

  async getScreenConfigById(type: string): Promise<IScreenConfig | null> {
    const fromCache = this.cache.get(type);
    if (fromCache) return fromCache;

    const fromLocal = await this.loadFromLocal(type);
    if (fromLocal) return fromLocal;

    return null; // 同期関数でサーバーから取得
  }

  async updateScreenConfigs(configs: IScreenConfig[]): Promise<void> {
    for (const config of configs) {
      await this.localStorage.save(`screen_${config.type}`, config);
      this.cache.set(config.type, config);
    }
    if (this.gasService) {
      try {
        const records: string[][] = [];
        for (const config of configs) {
          for (const [key, value] of config.toRecords()) {
            records.push([config.id, config.type, key, value]);
          }
        }
        await new Promise<void>((resolve, reject) => {
          this.gasService!.createCall<void>(
            "ScreenConfigService.updateScreenConfig",
            records
          )
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        });
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

  async syncScreenConfigs(): Promise<void> {
    if (!this.gasService) throw new Error("GAS service not available");
    // サーバーから全画面設定を取得
    try {
      const settings: ScreenSettings = await new Promise<ScreenSettings>(
        (resolve, reject) => {
          this.gasService!.createCall<ScreenSettings>(
            "ScreenConfigService.getScreenConfigs"
          )
            .withSuccessed((res: ScreenSettings) => resolve(res))
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        }
      );
      // settings.settings を grouped して IScreenConfig に変換
      const grouped = settings.settings.reduce(
        (acc, [id, type, key, value]) => {
          acc[type] ||= { id, type, records: new Map<string, string>() };
          acc[type].records.set(key, value);
          return acc;
        },
        {} as Record<
          string,
          { id: string; type: string; records: Map<string, string> }
        >
      );
      const serverConfigs: IScreenConfig[] = [];
      for (const type in grouped) {
        const { id, records: configMap } = grouped[type];
        let config: IScreenConfig;
        switch (type) {
          case "home":
            config = new HomeScreenConfig(
              configMap.get("homeBgm") || "",
              configMap.get("buttonClikingSE") || "",
              configMap.get("onCompletedLoadingSE") || "",
              id
            );
            break;
          case "opening":
            config = new OpeningScreenConfig(
              configMap.get("openingBgm") || "",
              configMap.get("openingSe1") || "",
              configMap.get("openingSe2") || "",
              id
            );
            break;
          case "description":
            config = new DescriptionScreenConfig(
              configMap.get("descriptionBgm") || "",
              JSON.parse(configMap.get("screenElements") || "[]"),
              id
            );
            break;
          case "demo":
            config = new DemoScreenConfig(
              configMap.get("demoBgm") || "",
              configMap.get("demoSe1") || "",
              configMap.get("demoSe2") || "",
              id
            );
            break;
          case "main":
            config = new MainScreenConfig(
              configMap.get("mainBgm") || "",
              configMap.get("mainSe1") || "",
              configMap.get("mainSe2") || "",
              id
            );
            break;
          case "result":
            config = new ResultScreenConfig(
              configMap.get("resultBgm") || "",
              configMap.get("resultSe1") || "",
              configMap.get("resultSe2") || "",
              id
            );
            break;
          case "ending":
            config = new EndingScreenConfig(
              configMap.get("endingBgm") || "",
              configMap.get("endingSe1") || "",
              configMap.get("endingSe2") || "",
              id
            );
            break;
          default:
            continue;
        }
        serverConfigs.push(config);
        this.cache.set(type, config);
        await this.localStorage.save(`screen_${type}`, config);
      }
      // サーバーにないローカルの設定を削除
      const localConfigs = await this.getScreenConfigs();
      const serverTypes = new Set(serverConfigs.map((c) => c.type));
      const toDelete = localConfigs.filter((c) => !serverTypes.has(c.type));
      for (const config of toDelete) {
        await this.localStorage.remove(`screen_${config.type}`);
        this.cache.delete(config.type);
      }
    } catch (e) {
      console.warn("Failed to sync screen configs:", e);
    }
  }

  private async loadFromLocal(
    type: string
  ): Promise<IScreenConfig | undefined> {
    try {
      const stored = await this.localStorage.get<IScreenConfig>(
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
