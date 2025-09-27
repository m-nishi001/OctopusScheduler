
import { injectable, inject } from "tsyringe";
import { ScreenConfig } from '../../domain/entities/screen-config';
import { ScreenConfigRepository } from '../../domain/repositories/screen-config-repository';
import { GasService } from "./gas-service";

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

    async saveScreenConfig(args: { config: ScreenConfig }): Promise<void> {
        await this.repository.saveScreenConfig(args.config);
    }

    async getScreenConfig(): Promise<ScreenConfig | null> {
        return await this.repository.getScreenConfig();
    }

    async findAll(): Promise<ScreenConfig[]> {
        return await this.repository.findAll();
    }

    async findByType(args: { type: string }): Promise<ScreenConfig | null> {
        return await this.repository.findByType(args.type);
    }

    async update(args: { type: string; updateEntity: (config: ScreenConfig) => ScreenConfig }): Promise<number> {
        return await this.repository.update(args.type, args.updateEntity);
    }

    async updateMany(args: { types: string[]; updateEntity: (config: ScreenConfig) => ScreenConfig }): Promise<number> {
        return await this.repository.updateMany(args.types, args.updateEntity);
    }

    async delete(args: { type: string }): Promise<void> {
        await this.repository.delete(args.type);
    }

    async deleteMany(args: { types: string[] }): Promise<void> {
        await this.repository.deleteMany(args.types);
    }
}
