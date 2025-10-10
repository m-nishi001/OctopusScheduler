import { injectable } from "tsyringe";
import { IScreenConfigRepository } from "../../domain/repositories/screen-config-repository";
import { ScreenConfig } from "../../domain/entities/screen-config";
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
export class ScreenConfigRepositoryImpl implements IScreenConfigRepository {
  private readonly repository: ISpreadsheetService<ScreenConfigRow>;
  private readonly sheetName = "ScreenConfigs";

  constructor() {
    this.repository = SpreadsheetService.getService<ScreenConfigRow>(
      this.sheetName
    );
  }

  private toRows(config: ScreenConfig): ScreenConfigRow[] {
    const rows: ScreenConfigRow[] = [];
    const screenName = config.type;
    for (const [key, value] of Object.entries(config)) {
      if (key === "type") continue;
      const settingValue =
        typeof value === "string" ? value : JSON.stringify(value);
      rows.push({
        screenName,
        settingName: key,
        settingValue,
      });
    }
    return rows;
  }

  private fromRows(rows: ScreenConfigRow[]): ScreenConfig[] {
    const grouped = rows.reduce(
      (acc, row) => {
        (acc[row.screenName] ||= []).push(row);
        return acc;
      },
      {} as Record<string, ScreenConfigRow[]>
    );

    const configs: ScreenConfig[] = [];
    for (const screenName in grouped) {
      const configRows = grouped[screenName];
      const config: any = { type: screenName };
      for (const row of configRows) {
        const value =
          row.settingValue.startsWith('"') ||
          row.settingValue.startsWith("{") ||
          row.settingValue.startsWith("[")
            ? JSON.parse(row.settingValue)
            : row.settingValue;
        config[row.settingName] = value;
      }
      configs.push(config as ScreenConfig);
    }
    return configs;
  }

  getScreenConfigs(): ScreenConfig[] {
    const rows = this.repository.find((r: ScreenConfigRow) => true);
    return this.fromRows(rows);
  }

  getScreenConfigById(type: string): ScreenConfig | null {
    const rows = this.repository.find(
      (r: ScreenConfigRow) => r.screenName === type
    );
    const configs = this.fromRows(rows);
    return configs.length > 0 ? configs[0] : null;
  }

  updateScreenConfigs(configs: ScreenConfig[]): void {
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

  addScreenConfigs(configs: ScreenConfig[]): void {
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
