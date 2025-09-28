import { injectable } from "tsyringe";
import { IScreenConfigRepository } from "../../domain/repositories/screen-config-repository";
import { ScreenConfig } from "../../domain/entities/screen-config";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class ScreenConfigRepositoryImpl implements IScreenConfigRepository {
  private readonly repository: ISpreadsheetService<ScreenConfig>;
  private readonly sheetName = "ScreenConfigs";

  constructor() {
    this.repository = SpreadsheetService.getService<ScreenConfig>(
      this.sheetName
    );
  }

  saveScreenConfig(config: ScreenConfig): void {
    this.repository.add(config);
  }

  getScreenConfig(): ScreenConfig | null {
    const configs = this.repository.find((c: ScreenConfig) => true);
    return configs.length > 0 ? configs[0] : null;
  }

  findAll(): ScreenConfig[] {
    return this.repository.find((c: ScreenConfig) => true);
  }

  findByType(type: string): ScreenConfig | null {
    const configs = this.repository.find((c: ScreenConfig) => c.type === type);
    return configs.length > 0 ? configs[0] : null;
  }

  update(
    type: string,
    updateEntity: (config: ScreenConfig) => ScreenConfig
  ): number {
    return this.repository.update(
      (c: ScreenConfig) => c.type === type,
      updateEntity
    );
  }

  updateMany(
    types: string[],
    updateEntity: (config: ScreenConfig) => ScreenConfig
  ): number {
    return this.repository.update(
      (c: ScreenConfig) => types.includes(c.type),
      updateEntity
    );
  }

  delete(type: string): void {
    this.repository.delete((c: ScreenConfig) => c.type === type);
  }

  deleteMany(types: string[]): void {
    this.repository.delete((c: ScreenConfig) => types.includes(c.type));
  }
}
