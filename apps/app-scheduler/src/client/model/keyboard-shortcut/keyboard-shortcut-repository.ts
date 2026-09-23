import { injectable, inject } from "tsyringe";
import { KeyboardShortcut } from "./keyboard-shortcut";
import type { KeyboardShortcutData } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";
import type { KeyboardShortcutConfigData } from "./keyboard-shortcut-config";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { IOctopusSchedulerApiToken } from "../../../server/scheduler-api-contract";
import type { OctopusSchedulerApi } from "../../../server/scheduler-api-contract";

@injectable()
export class KeyboardShortcutRepository {
  private readonly localStorage: LocalStorageService;

  constructor(
    @inject(IOctopusSchedulerApiToken)
    private readonly schedulerApi: OctopusSchedulerApi
  ) {
    this.localStorage = new LocalStorageService(
      "octopus-scheduler",
      "KeyboardShortcut"
    );
  }

  async getKeyboardShortcutsRaw(): Promise<KeyboardShortcutData[]> {
    const data =
      await this.localStorage.get<KeyboardShortcutData[]>("shortcuts");
    return data || [];
  }

  async saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void> {
    const datas = shortcuts.map((s) => s.serialize());
    // Ensure we pass plain JSON-serializable objects to LocalStorageService
    // This strips classes, methods and prototypes that may cause structured clone errors.
    const serializableDatas = JSON.parse(JSON.stringify(datas));
    await this.localStorage.save("shortcuts", serializableDatas as any);
  }

  async getConfig(): Promise<KeyboardShortcutConfig> {
    const data =
      await this.localStorage.get<KeyboardShortcutConfigData>("config");
    if (data) {
      return KeyboardShortcutConfig.fromData(data);
    }
    return KeyboardShortcutConfig.createEmpty();
  }

  async saveConfig(config: KeyboardShortcutConfig): Promise<void> {
    const data = config.serialize();
    await this.localStorage.save("config", data);
  }

  async syncWithServer(
    direction: "gas-to-local" | "local-to-gas"
  ): Promise<void> {
    if (direction === "gas-to-local") {
      // GASからデータを取得し、ローカルを完全上書き
      try {
        const remoteData = await this.schedulerApi.getKeyboardShortcuts(
          undefined,
          { timeout: 30000 }
        );
        if (remoteData) {
          await this.localStorage.save(
            "shortcuts",
            remoteData.shortcuts as any
          );
          await this.localStorage.save("config", remoteData.config as any);
        }
      } catch (error) {
        throw new Error(`GASからの同期に失敗: ${(error as Error).message}`);
      }
    } else if (direction === "local-to-gas") {
      // ローカルデータを取得し、GASに送信して上書き
      const shortcuts = await this.getKeyboardShortcutsRaw();
      const config = await this.getConfig();
      try {
        const wireShortcuts = shortcuts.map((data) => ({
          id: data.id,
          keys: data.keys,
          eventIds: data.eventIds ?? [],
        }));
        await this.schedulerApi.setKeyboardShortcuts(
          {
            shortcuts: wireShortcuts,
            config: config.serialize(),
          },
          { timeout: 30000 }
        );
      } catch (error) {
        throw new Error(`GASへの同期に失敗: ${(error as Error).message}`);
      }
    }
  }
}
