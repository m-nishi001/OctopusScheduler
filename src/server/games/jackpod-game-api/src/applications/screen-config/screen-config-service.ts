import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import {
  ScreenConfigDto,
  toScreenConfig,
  toScreenConfigDto,
} from "./screen-config-dto";
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

  getScreenConfigs(): ScreenConfigDto[] {
    const configs = this.repository.getScreenConfigs();
    return configs.map(toScreenConfigDto);
  }

  getScreenConfig(args: { id: string }): ScreenConfigDto | null {
    const config = this.repository.getScreenConfigById(args.id);
    return config ? toScreenConfigDto(config) : null;
  }

  updateScreenConfig(args: { config: ScreenConfigDto }): void {
    const config = toScreenConfig(args.config);
    this.repository.updateScreenConfigs([config]);
  }

  deleteScreenConfig(args: { type: string }): void {
    this.repository.deleteScreenConfigs([args.type]);
  }

  addScreenConfigs(args: { configs: ScreenConfigDto[] }): void {
    const configs = args.configs.map(toScreenConfig);
    this.repository.addScreenConfigs(configs);
  }
}
