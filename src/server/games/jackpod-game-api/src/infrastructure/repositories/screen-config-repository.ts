import { injectable } from "tsyringe";
import { IScreenConfigRepository } from "../../domain/screen-config/screen-config-repository";
import { IScreenConfig } from "../../domain/screen-config/IScreenConfig";
import { HomeScreenConfig } from "../../domain/screen-config/HomeScreenConfig";
import { OpeningScreenConfig } from "../../domain/screen-config/OpeningScreenConfig";
import { DescriptionScreenConfig } from "../../domain/screen-config/DescriptionScreenConfig";
import { DemoScreenConfig } from "../../domain/screen-config/DemoScreenConfig";
import { MainScreenConfig } from "../../domain/screen-config/MainScreenConfig";
import { ResultScreenConfig } from "../../domain/screen-config/ResultScreenConfig";
import { EndingScreenConfig } from "../../domain/screen-config/EndingScreenConfig";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../../shared-packages/src/google-spreadsheet-service";

interface ScreenConfigRow {
  screenName: string;
  settingName: string;
  settingValue: string;
}

@injectable()
export class ScreenConfigRepository implements IScreenConfigRepository {
  private readonly repository: ISpreadsheetService<ScreenConfigRow>;
  private readonly sheetName = "ScreenConfigs";

  constructor() {
    this.repository = SpreadsheetService.getService<ScreenConfigRow>(
      this.sheetName
    );
  }

  private toRows(config: IScreenConfig): ScreenConfigRow[] {
    const rows: ScreenConfigRow[] = [];
    const screenName = config.type;
    for (const [key, value] of config.toRecords()) {
      rows.push({
        screenName,
        settingName: key,
        settingValue: value,
      });
    }
    return rows;
  }

  private fromRows(rows: ScreenConfigRow[]): IScreenConfig[] {
    const grouped = rows.reduce(
      (acc, row) => {
        (acc[row.screenName] ||= []).push(row);
        return acc;
      },
      {} as Record<string, ScreenConfigRow[]>
    );

    const configs: IScreenConfig[] = [];
    for (const screenName in grouped) {
      const configRows = grouped[screenName];
      const configMap = new Map<string, string>();
      for (const row of configRows) {
        configMap.set(row.settingName, row.settingValue);
      }
      let config: IScreenConfig;
      switch (screenName) {
        case "home":
          config = new HomeScreenConfig(
            configMap.get("homeBgm") || "",
            configMap.get("buttonClikingSE") || "",
            configMap.get("onCompletedLoadingSE") || "",
            configRows.find((r) => r.settingName === "id")?.settingValue ||
              undefined
          );
          break;
        case "opening":
          config = new OpeningScreenConfig(
            configMap.get("openingBgm") || "",
            configMap.get("openingSe1") || "",
            configMap.get("openingSe2") || "",
            configRows.find((r) => r.settingName === "id")?.settingValue ||
              undefined
          );
          break;
        case "description":
          config = new DescriptionScreenConfig(
            configMap.get("descriptionBgm") || "",
            configMap.get("descriptionSe1") || "",
            configMap.get("descriptionSe2") || "",
            configRows.find((r) => r.settingName === "id")?.settingValue ||
              undefined
          );
          break;
        case "demo":
          config = new DemoScreenConfig(
            configMap.get("demoBgm") || "",
            configMap.get("demoSe1") || "",
            configMap.get("demoSe2") || "",
            configRows.find((r) => r.settingName === "id")?.settingValue ||
              undefined
          );
          break;
        case "main":
          config = new MainScreenConfig(
            configMap.get("mainBgm") || "",
            configMap.get("mainSe1") || "",
            configMap.get("mainSe2") || "",
            configRows.find((r) => r.settingName === "id")?.settingValue ||
              undefined
          );
          break;
        case "result":
          config = new ResultScreenConfig(
            configMap.get("resultBgm") || "",
            configMap.get("resultSe1") || "",
            configMap.get("resultSe2") || "",
            configRows.find((r) => r.settingName === "id")?.settingValue ||
              undefined
          );
          break;
        case "ending":
          config = new EndingScreenConfig(
            configMap.get("endingBgm") || "",
            configMap.get("endingSe1") || "",
            configMap.get("endingSe2") || "",
            configRows.find((r) => r.settingName === "id")?.settingValue ||
              undefined
          );
          break;
        default:
          throw new Error(`Unknown screen type: ${screenName}`);
      }
      configs.push(config);
    }
    return configs;
  }

  getScreenConfigs(): IScreenConfig[] {
    const rows = this.repository.find((r: ScreenConfigRow) => true);
    return this.fromRows(rows);
  }

  getScreenConfigById(type: string): IScreenConfig | null {
    const rows = this.repository.find(
      (r: ScreenConfigRow) => r.screenName === type
    );
    const configs = this.fromRows(rows);
    return configs.length > 0 ? configs[0] : null;
  }

  updateScreenConfigs(configs: IScreenConfig[]): void {
    const transaction = this.repository.beginTransaction();
    for (const config of configs) {
      transaction.delete((r: ScreenConfigRow) => r.screenName === config.type);
      const rows = this.toRows(config);
      for (const row of rows) {
        transaction.add(row);
      }
    }
    transaction.commit();
  }

  deleteScreenConfigs(types: string[]): void {
    for (const type of types) {
      this.repository.delete((r: ScreenConfigRow) => r.screenName === type);
    }
  }

  addScreenConfigs(configs: IScreenConfig[]): void {
    const transaction = this.repository.beginTransaction();
    for (const config of configs) {
      const rows = this.toRows(config);
      for (const row of rows) {
        transaction.add(row);
      }
    }
    transaction.commit();
  }
}
