import { injectable, inject } from "tsyringe";
import { ScreenConfig } from "../../domain/entities/screen-config";
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
      createScreenConfig: this.createScreenConfig.bind(this),
      updateScreenConfig: this.updateScreenConfig.bind(this),
      deleteScreenConfig: this.deleteScreenConfig.bind(this),
      getScreenConfig: this.getScreenConfig.bind(this),
      findAll: this.findAll.bind(this),
      findByType: this.findByType.bind(this),
      update: this.update.bind(this),
      updateMany: this.updateMany.bind(this),
      delete: this.delete.bind(this),
      deleteMany: this.deleteMany.bind(this),
    };
  }

  createScreenConfig(args: { config: ScreenConfigDto }): string {
    const config = toScreenConfig(args.config);
    config.id = Utilities.getUuid();
    config.elements.forEach((element) => {
      if (!element.id) {
        element.id = Utilities.getUuid();
      }
    });
    this.repository.createScreenConfig(config);
    return "ok";
  }

  updateScreenConfig(args: { config: ScreenConfigDto }): string {
    const config = toScreenConfig(args.config);
    this.repository.updateScreenConfig(config);
    return "ok";
  }

  deleteScreenConfig(args: { type: string }): string {
    this.repository.deleteScreenConfig(args.type);
    return "ok";
  }

  getScreenConfig(): ScreenConfigDto | null {
    const config = this.repository.getScreenConfig();
    return config ? toScreenConfigDto(config) : null;
  }

  findAll(): ScreenConfigDto[] {
    const configs = this.repository.findAll();
    return configs.map(toScreenConfigDto);
  }

  findByType(args: { type: string }): ScreenConfigDto | null {
    const config = this.repository.findByType(args.type);
    return config ? toScreenConfigDto(config) : null;
  }

  update(args: {
    type: string;
    updateEntity: (config: ScreenConfigDto) => ScreenConfigDto;
  }): number {
    return this.repository.update(args.type, (entity: ScreenConfig) =>
      toScreenConfig(args.updateEntity(toScreenConfigDto(entity)))
    );
  }

  updateMany(args: {
    types: string[];
    updateEntity: (config: ScreenConfigDto) => ScreenConfigDto;
  }): number {
    return this.repository.updateMany(args.types, (entity: ScreenConfig) =>
      toScreenConfig(args.updateEntity(toScreenConfigDto(entity)))
    );
  }

  delete(args: { type: string }): void {
    this.repository.delete(args.type);
  }

  deleteMany(args: { types: string[] }): void {
    this.repository.deleteMany(args.types);
  }
}
