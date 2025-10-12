import { injectable } from "tsyringe";
import { IScreenConfigRepository } from "../../domain/screen-config/screen-config-repository";
import { ScreenSettings } from "../../domain/screen-config/screen-settings";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../../shared-packages/src/google-spreadsheet-service";

interface ScreenConfigRow {
  id: string;
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

  getScreenConfigs(): ScreenSettings {
    const rows = this.repository.find((r: ScreenConfigRow) => true);
    return new ScreenSettings(
      rows.map((row) => [
        row.id,
        row.screenName,
        row.settingName,
        row.settingValue,
      ])
    );
  }

  updateScreenSettings(settings: ScreenSettings): void {
    const transaction = this.repository.beginTransaction();
    transaction.delete((r: ScreenConfigRow) => true);
    for (const row of settings.settings) {
      const [id, screenName, settingName, settingValue] = row;
      transaction.add({ id, screenName, settingName, settingValue });
    }
    transaction.commit();
  }

  deleteScreenConfigs(types: string[]): void {
    for (const type of types) {
      this.repository.delete((r: ScreenConfigRow) => r.screenName === type);
    }
  }

  addScreenConfigs(configs: ScreenSettings): void {
    const transaction = this.repository.beginTransaction();
    for (const row of configs.settings) {
      const [id, screenName, settingName, settingValue] = row;
      transaction.add({ id, screenName, settingName, settingValue });
    }
    transaction.commit();
  }
}
