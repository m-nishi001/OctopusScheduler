import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import { IScreenConfigRepository } from "../../domain/screen-config/screen-config-repository";
import { ScreenSetting } from "../../domain/screen-config/screen-setting";

@injectable()
export class ScreenConfigService implements GasService {
  public serviceName = "ScreenConfigService";
  public functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IScreenConfigRepository")
    private readonly repository: IScreenConfigRepository
  ) {
    this.functions = {
      getScreenConfigs: this.getScreenConfigs,
      updateScreenConfig: this.updateScreenConfig,
      deleteScreenConfig: this.deleteScreenConfig,
      addScreenConfigs: this.addScreenConfigs,
    };
  }

  getScreenConfigs(): ScreenSetting[] {
    return this.repository.getScreenConfigs();
  }

  updateScreenConfig(args: ScreenSetting[]): void {
    this.repository.updateScreenSettings(args);
  }

  deleteScreenConfig(args: { type: string }): void {
    this.repository.deleteScreenConfigs([args.type]);
  }

  addScreenConfigs(args: { configs: ScreenSetting[] }): void {
    this.repository.addScreenConfigs(args.configs);
  }
}
