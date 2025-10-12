import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import type { IScreenConfig } from "../../domains/screen-config/i-screen-config";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/i-screen-config-repository";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { HomeScreenConfig } from "../../domains/screen-config/home-screen-config";
import { OpeningScreenConfig } from "../../domains/screen-config/opening-screen-config";
import { DescriptionScreenConfig } from "../../domains/screen-config/description-screen-config";
import { DemoScreenConfig } from "../../domains/screen-config/demo-screen-config";
import { MainScreenConfig } from "../../domains/screen-config/main-screen-config";
import { ResultScreenConfig } from "../../domains/screen-config/result-screen-config";
import { EndingScreenConfig } from "../../domains/screen-config/ending-screen-config";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";

@injectable()
export class ScreenConfigRepository implements IScreenConfigRepository {
  private cache: Map<string, IScreenConfig> = new Map();
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScreenConfigData")
  );
  private readonly gasService = GasFunctionService.create("callJackpotGameApi");

  private readonly configFactories: Record<
    string,
    (id: string, records: Map<string, string>) => IScreenConfig
  > = {
    home: HomeScreenConfig.fromRecords,
    opening: OpeningScreenConfig.fromRecords,
    description: DescriptionScreenConfig.fromRecords,
    demo: DemoScreenConfig.fromRecords,
    main: MainScreenConfig.fromRecords,
    result: ResultScreenConfig.fromRecords,
    ending: EndingScreenConfig.fromRecords,
  };

  async getScreenConfigs(): Promise<IScreenConfig[]> {
    const settings =
      (await this.localStorage.get<ScreenSetting[]>("screenConfigs")) || [];
    const grouped = this.groupSettings(settings);
    const configs: IScreenConfig[] = [];
    for (const [type, data] of Object.entries(grouped)) {
      const factory = this.configFactories[type];
      if (factory) {
        configs.push(factory(data.id, data.records));
      }
    }
    return configs;
  }

  async getScreenConfigById(type: string): Promise<IScreenConfig | null> {
    const fromCache = this.cache.get(type);
    if (fromCache) return fromCache;

    const settings =
      (await this.localStorage.get<ScreenSetting[]>("screenConfigs")) || [];
    const grouped = this.groupSettings(settings);
    const data = grouped[type];
    if (data) {
      const config = this.configFactories[type]?.(data.id, data.records);
      if (config) {
        this.cache.set(type, config);
        return config;
      }
    }
    return null;
  }

  async updateScreenConfigs(configs: IScreenConfig[]): Promise<void> {
    const allSettings =
      (await this.localStorage.get<ScreenSetting[]>("screenConfigs")) || [];
    const grouped = this.groupSettings(allSettings);
    const settingsToUpdate: ScreenSetting[] = [];
    for (const config of configs) {
      const settingsForConfig: ScreenSetting[] = [];
      for (const [key, value] of config.toRecords()) {
        const setting = new ScreenSetting(config.id, config.type, key, value);
        settingsForConfig.push(setting);
        settingsToUpdate.push(setting);
      }
      grouped[config.type] = {
        id: config.id,
        type: config.type,
        records: config.toRecords(),
      };
      this.cache.set(config.type, config);
    }
    const updatedSettings = (
      Object.values(grouped) as {
        id: string;
        type: string;
        records: Map<string, string>;
      }[]
    ).flatMap((item) =>
      Array.from(item.records.entries()).map(
        ([key, value]) => new ScreenSetting(item.id, item.type, key, value)
      )
    );
    await this.localStorage.save("screenConfigs", updatedSettings);
    if (this.gasService) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.gasService!.createCall<void>(
            "ScreenConfigService.updateScreenConfig",
            settingsToUpdate
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
    const allSettings =
      (await this.localStorage.get<ScreenSetting[]>("screenConfigs")) || [];
    const filteredSettings = allSettings.filter(
      (setting) => !types.includes(setting.screenName)
    );
    await this.localStorage.save("screenConfigs", filteredSettings);
    for (const type of types) {
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
    try {
      const settings: ScreenSetting[] = await new Promise<ScreenSetting[]>(
        (resolve, reject) => {
          this.gasService!.createCall<ScreenSetting[]>(
            "ScreenConfigService.getScreenConfigs"
          )
            .withSuccessed((res: ScreenSetting[]) => resolve(res))
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        }
      );
      await this.localStorage.save("screenConfigs", settings);
      this.cache.clear(); // キャッシュをクリアして次回再構築
    } catch (e) {
      console.warn("Failed to sync screen configs:", e);
    }
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

  private groupSettings(
    settings: ScreenSetting[]
  ): Record<
    string,
    { id: string; type: string; records: Map<string, string> }
  > {
    return settings.reduce(
      (acc, setting) => {
        acc[setting.screenName] ||= {
          id: setting.id,
          type: setting.screenName,
          records: new Map<string, string>(),
        };
        acc[setting.screenName].records.set(
          setting.settingName,
          setting.settingValue
        );
        return acc;
      },
      {} as Record<
        string,
        { id: string; type: string; records: Map<string, string> }
      >
    );
  }
}
