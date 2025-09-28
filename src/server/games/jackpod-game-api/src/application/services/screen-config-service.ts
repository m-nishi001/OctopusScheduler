import { injectable, inject } from "tsyringe";
import { ScreenConfig } from '../../domain/entities/screen-config';
import { ScreenConfigRepository } from '../../domain/repositories/screen-config-repository';
import { GasService } from "./gas-service";
import { ScreenConfigDto, toScreenConfig, toScreenConfigDto } from '../dtos/screen-config-dto';

@injectable()
export class ScreenConfigService implements GasService {
    public serviceName = "ScreenConfigService";
    public functions: Record<string, (args: any) => any>;

    constructor(@inject("IScreenConfigRepository") private readonly repository: ScreenConfigRepository) {
        this.functions = {
            saveScreenConfig: this.saveScreenConfig.bind(this),
            getScreenConfig: this.getScreenConfig.bind(this),
            findAll: this.findAll.bind(this),
            findByType: this.findByType.bind(this),
            update: this.update.bind(this),
            updateMany: this.updateMany.bind(this),
            delete: this.delete.bind(this),
            deleteMany: this.deleteMany.bind(this)
        };
    }

    async saveScreenConfig(args: { config: ScreenConfigDto }): Promise<void> {
        await this.repository.saveScreenConfig(toScreenConfig(args.config));
    }

    async getScreenConfig(): Promise<ScreenConfigDto | null> {
        const config = await this.repository.getScreenConfig();
        return config ? toScreenConfigDto(config) : null;
    }

    async findAll(): Promise<ScreenConfigDto[]> {
        const configs = await this.repository.findAll();
        return configs.map(toScreenConfigDto);
    }

    async findByType(args: { type: string }): Promise<ScreenConfigDto | null> {
        const config = await this.repository.findByType(args.type);
        return config ? toScreenConfigDto(config) : null;
    }

    async update(args: { type: string; updateEntity: (config: ScreenConfigDto) => ScreenConfigDto }): Promise<number> {
        return await this.repository.update(
            args.type,
            (entity: ScreenConfig) => toScreenConfig(args.updateEntity(toScreenConfigDto(entity)))
        );
    }

    async updateMany(args: { types: string[]; updateEntity: (config: ScreenConfigDto) => ScreenConfigDto }): Promise<number> {
        return await this.repository.updateMany(
            args.types,
            (entity: ScreenConfig) => toScreenConfig(args.updateEntity(toScreenConfigDto(entity)))
        );
    }

    async delete(args: { type: string }): Promise<void> {
        await this.repository.delete(args.type);
    }

    async deleteMany(args: { types: string[] }): Promise<void> {
        await this.repository.deleteMany(args.types);
    }
}
