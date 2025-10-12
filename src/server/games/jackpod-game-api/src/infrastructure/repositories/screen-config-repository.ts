import { injectable } from "tsyringe";
import { IScreenConfigRepository } from "../../domain/screen-config/screen-config-repository";
import { ScreenSetting } from "../../domain/screen-config/screen-settings";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class ScreenConfigRepository implements IScreenConfigRepository {
  private readonly repository: ISpreadsheetService<ScreenSetting>;
  private readonly sheetName = "ScreenConfigs";

  constructor() {
    this.repository = SpreadsheetService.getService<ScreenSetting>(
      this.sheetName
    );
  }

  getScreenConfigs(): ScreenSetting[] {
    return this.repository.find((r: ScreenSetting) => true);
  }

  updateScreenSettings(settings: ScreenSetting[]): void {
    const transaction = this.repository.beginTransaction();
    transaction.delete((r: ScreenSetting) => true);
    for (const setting of settings) {
      transaction.add(setting);
    }
    transaction.commit();
  }

  deleteScreenConfigs(types: string[]): void {
    for (const type of types) {
      this.repository.delete((r: ScreenSetting) => r.screenName === type);
    }
  }

  addScreenConfigs(configs: ScreenSetting[]): void {
    const transaction = this.repository.beginTransaction();
    for (const setting of configs) {
      transaction.add(setting);
    }
    transaction.commit();
  }
}
