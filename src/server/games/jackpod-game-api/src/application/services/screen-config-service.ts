import { injectable, inject } from "tsyringe";
import { IScreenConfigRepository } from "../../domain/repositories/screen-config-repository";
import { GasService } from "./gas-service";
import {
  ScreenConfigDto,
  toScreenConfig,
  toScreenConfigDto,
} from "../dtos/screen-config.dto";

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
      getScreenConfigById: this.getScreenConfigById,
      updateScreenConfigs: this.updateScreenConfigs,
      deleteScreenConfigs: this.deleteScreenConfigs,
      addScreenConfigs: this.addScreenConfigs,
    };
  }

  getScreenConfigs(): ScreenConfigDto[] {
    const configs = this.repository.findAll();
    return configs.map(toScreenConfigDto);
  }

  getScreenConfigById(args: { id: string }): ScreenConfigDto | null {
    const config = this.repository.findByType(args.id);
    return config ? toScreenConfigDto(config) : null;
  }

  updateScreenConfigs(args: { configs: ScreenConfigDto[] }): void {
    const configs = args.configs.map(toScreenConfig);
    this.repository.updateScreenConfigs(configs);
  }

  deleteScreenConfigs(args: { ids: string[] }): void {
    this.repository.deleteMany(args.ids);
  }

  addScreenConfigs(args: { configs: ScreenConfigDto[] }): string {
    const configs = args.configs.map(toScreenConfig);
    this.repository.createScreenConfigs(configs);
    return "ok";
  }
}
