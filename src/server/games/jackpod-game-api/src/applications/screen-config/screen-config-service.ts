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
      getScreenConfigById: this.getScreenConfigById,
      updateScreenConfigs: this.updateScreenConfigs,
      deleteScreenConfigs: this.deleteScreenConfigs,
      addScreenConfigs: this.addScreenConfigs,
    };
  }

  async getScreenConfigs(): Promise<ScreenConfigDto[]> {
    const configs = await this.repository.getScreenConfigs();
    return configs.map(toScreenConfigDto);
  }

  async getScreenConfigById(args: {
    id: string;
  }): Promise<ScreenConfigDto | null> {
    const config = await this.repository.getScreenConfigById(args.id);
    return config ? toScreenConfigDto(config) : null;
  }

  async updateScreenConfigs(args: {
    configs: ScreenConfigDto[];
  }): Promise<void> {
    const configs = args.configs.map(toScreenConfig);
    await this.repository.updateScreenConfigs(configs);
  }

  async deleteScreenConfigs(args: { ids: string[] }): Promise<void> {
    await this.repository.deleteScreenConfigs(args.ids);
  }

  async addScreenConfigs(args: { configs: ScreenConfigDto[] }): Promise<void> {
    const configs = args.configs.map(toScreenConfig);
    await this.repository.addScreenConfigs(configs);
  }
}
