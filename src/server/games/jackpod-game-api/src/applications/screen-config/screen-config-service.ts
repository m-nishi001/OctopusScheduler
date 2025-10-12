import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import { IScreenConfig } from "../../domain/screen-config/IScreenConfig";
import { IScreenConfigRepository } from "../../domain/screen-config/screen-config-repository";

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
      getScreenConfig: this.getScreenConfig,
      updateScreenConfig: this.updateScreenConfig,
      deleteScreenConfig: this.deleteScreenConfig,
      addScreenConfigs: this.addScreenConfigs,
    };
  }

  getScreenConfigs(): IScreenConfig[] {
    return this.repository.getScreenConfigs();
  }

  getScreenConfig(args: { id: string }): IScreenConfig | null {
    return this.repository.getScreenConfigById(args.id);
  }

  updateScreenConfig(args: { config: IScreenConfig }): void {
    this.repository.updateScreenConfigs([args.config]);
  }

  deleteScreenConfig(args: { type: string }): void {
    this.repository.deleteScreenConfigs([args.type]);
  }

  addScreenConfigs(args: { configs: IScreenConfig[] }): void {
    this.repository.addScreenConfigs(args.configs);
  }
}
