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
      let settingValue: string;
      if (typeof value === "string") {
        settingValue = value;
      } else {
        settingValue = JSON.stringify(value);
      }
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
        if (!acc[row.screenName]) {
          acc[row.screenName] = [];
        }
        acc[row.screenName].push(row);
        return acc;
      },
      {} as Record<string, ScreenConfigRow[]>
    );

    const configs: ScreenConfig[] = [];
    for (const screenName in grouped) {
      const configRows = grouped[screenName];
      const config: any = { type: screenName };
      for (const row of configRows) {
        const value = row.settingValue;
        try {
          config[row.settingName] = JSON.parse(value);
        } catch {
          config[row.settingName] = value;
        }
      }
      configs.push(config as ScreenConfig);
    }
    return configs;
  }

  createScreenConfigs(configs: ScreenConfig[]): void {
    const transaction = this.repository.beginTransaction();
    for (const config of configs) {
      const rows = this.toRows(config);
      for (const row of rows) {
        transaction.add(row);
      }
    }
    transaction.commit();
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

  deleteScreenConfig(type: string): void {
    this.repository.delete((r: ScreenConfigRow) => r.screenName === type);
  }

  getScreenConfig(): ScreenConfig | null {
    const configs = this.findAll();
    return configs.length > 0 ? configs[0] : null;
  }

  findAll(): ScreenConfig[] {
    const rows = this.repository.find((r: ScreenConfigRow) => true);
    return this.fromRows(rows);
  }

  findByType(type: string): ScreenConfig | null {
    const rows = this.repository.find(
      (r: ScreenConfigRow) => r.screenName === type
    );
    const configs = this.fromRows(rows);
    return configs.length > 0 ? configs[0] : null;
  }

  update(
    type: string,
    updateEntity: (config: ScreenConfig) => ScreenConfig
  ): number {
    const config = this.findByType(type);
    if (!config) return 0;
    const updated = updateEntity(config);
    this.repository.delete(
      (r: ScreenConfigRow) => r.screenName === updated.type
    );
    const rows = this.toRows(updated);
    for (const row of rows) {
      this.repository.add(row);
    }
    return 1;
  }

  updateMany(
    types: string[],
    updateEntity: (config: ScreenConfig) => ScreenConfig
  ): number {
    let count = 0;
    for (const type of types) {
      count += this.update(type, updateEntity);
    }
    return count;
  }

  delete(type: string): void {
    this.deleteScreenConfig(type);
  }

  deleteMany(types: string[]): void {
    for (const type of types) {
      this.deleteScreenConfig(type);
    }
  }
}
