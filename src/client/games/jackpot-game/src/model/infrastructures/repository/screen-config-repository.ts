import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
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
  private readonly gasService = GasFunctionService.create("callJackpotGameApi");

  // 画面設定を取得
  async fetchScreenConfig(type: string): Promise<ScreenConfig> {
    const config = this.cache.get(type);
    if (config) return config;

    // Try to get from GAS first (server is source of truth). If fails, fall back to localStorage
    if (this.gasService) {
      try {
        const dtoPromise = new Promise<ScreenConfig | null>(
          (resolve, reject) => {
            this.gasService!.createCall<any>("ScreenConfigService.findByType", {
              type,
            })
              .withSuccessed((res: any) => {
                if (res) resolve(res as ScreenConfig);
                else resolve(null);
              })
              .withFailuered((msg: string) => reject(new Error(msg)))
              .invoke();
          }
        );
        const dto = await dtoPromise;
        if (dto) {
          this.cache.set(type, dto);
          // persist to local for offline
          await this.localStorage.save(`screen_${type}`, dto);
          return dto;
        } else {
          // Server explicitly reports no config for this type. Treat server as source-of-truth:
          // remove any local copy and clear cache entry, then return a default config (do not persist locally)
          try {
            await this.localStorage.remove(`screen_${type}`);
          } catch (e) {
            console.warn(
              `Failed to remove local screen config for type '${type}':`,
              e
            );
          }
          this.cache.delete(type);
          const defaultConfig: ScreenConfig = {
            type: type as ScreenConfig["type"],
            bgmAssetId: undefined,
            seAssetIds: [],
            backgroundStyle: "",
            elements: [],
          };
          // Keep default in in-memory cache so UI can use it during this session.
          this.cache.set(type, defaultConfig);
          return defaultConfig;
        }
      } catch (e) {
        console.warn(
          "Failed to fetch screen config from GAS, falling back to local:",
          e
        );
      }
    }

    // キャッシュに無ければストレージから読み込んでキャッシュに入れて返す
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

    // Return default config if not found
    const defaultConfig: ScreenConfig = {
      type: type as ScreenConfig["type"],
      bgmAssetId: undefined,
      seAssetIds: [],
      backgroundStyle: "",
      elements: [],
    };
    this.cache.set(type, defaultConfig);
    await this.localStorage.save(`screen_${type}`, defaultConfig);
    return defaultConfig;
  }

  // 差分更新保存
  // Parallel save: save each config in parallel to avoid timeout
  async saveScreenConfigs(newConfigs: ScreenConfig[]): Promise<void> {
    // Determine which configs actually changed
    const toSave = newConfigs.filter((config) => {
      const prev = this.cache.get(config.type);
      return !prev || JSON.stringify(prev) !== JSON.stringify(config);
    });

    if (toSave.length === 0) return;

    if (this.gasService) {
      try {
        // Save each config in parallel
        const promises = toSave.map(
          (config) =>
            new Promise<void>((resolve, reject) => {
              const method = config.id
                ? "updateScreenConfig"
                : "createScreenConfig";
              this.gasService!.createCall<void>(
                `ScreenConfigService.${method}`,
                { config }
              )
                .withTimeout(120000) // 2 minutes timeout for heavy uploads
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
            })
        );
        await Promise.all(promises);
        // On all server successes, persist all to localStorage and update cache
        for (const config of toSave) {
          await this.localStorage.save(`screen_${config.type}`, config);
          this.cache.set(config.type, config);
        }
        return;
      } catch (e) {
        console.warn(
          "GAS parallel save failed, falling back to per-item local save:",
          e
        );
        // fallthrough to local save
      }
    }

    // Fallback: save locally per item
    for (const config of toSave) {
      await this.localStorage.save(`screen_${config.type}`, config);
      this.cache.set(config.type, config);
    }
  }

  // 初期化（localStorageからロード）
  async loadAllFromStorage(types: string[]): Promise<void> {
    // Try loading from server first (source-of-truth). If fails, load from local storage
    if (this.gasService) {
      try {
        const res = await new Promise<any[]>((resolve, reject) => {
          this.gasService!.createCall<any[]>("ScreenConfigService.findAll")
            .withSuccessed((r: any) => resolve(r || []))
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        });
        // create map of server configs by type
        const serverMap = new Map<string, any>();
        for (const cfg of res) {
          if (cfg && cfg.type) {
            serverMap.set(cfg.type, cfg);
          }
        }
        // persist server-returned configs and update cache for those types
        for (const [type, cfg] of serverMap.entries()) {
          await this.localStorage.save(`screen_${type}`, cfg);
          this.cache.set(type, cfg);
        }
        // For requested types that were NOT returned by server, remove local entries so local matches spreadsheet
        for (const type of types) {
          if (!serverMap.has(type)) {
            try {
              await this.localStorage.remove(`screen_${type}`);
            } catch (e) {
              // ignore removal errors but log
              console.warn(
                `Failed to remove local screen config for type '${type}':`,
                e
              );
            }
            this.cache.delete(type);
          }
        }
        return;
      } catch (e) {
        console.warn(
          "Failed to load configs from GAS, falling back to local storage:",
          e
        );
      }
    }

    for (const type of types) {
      const obj = await this.localStorage.get<ScreenConfig>(`screen_${type}`);
      if (obj) {
        this.cache.set(type, obj);
      }
    }
  }
}
