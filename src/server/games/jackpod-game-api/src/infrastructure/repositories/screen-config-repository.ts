
import { injectable } from "tsyringe";
import { ScreenConfigRepository } from '../../domain/repositories/screen-config-repository';
import { ScreenConfig } from '../../domain/entities/screen-config';
import { ISpreadsheetService, SpreadsheetService } from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class ScreenConfigRepositoryImpl implements ScreenConfigRepository {
    private readonly repository: ISpreadsheetService<ScreenConfig>;
    private readonly sheetName = "ScreenConfigs";

    constructor() {
        this.repository = SpreadsheetService.getService<ScreenConfig>(this.sheetName);
    }

    async saveScreenConfig(config: ScreenConfig): Promise<void> {
        this.repository.add(config);
    }

    async getScreenConfig(): Promise<ScreenConfig | null> {
        const configs = this.repository.find((c: ScreenConfig) => true);
        return configs.length > 0 ? configs[0] : null;
    }

    async findAll(): Promise<ScreenConfig[]> {
        return this.repository.find((c: ScreenConfig) => true);
    }

    async findByType(type: string): Promise<ScreenConfig | null> {
        const configs = this.repository.find((c: ScreenConfig) => c.type === type);
        return configs.length > 0 ? configs[0] : null;
    }

    async update(type: string, updateEntity: (config: ScreenConfig) => ScreenConfig): Promise<number> {
        return this.repository.update((c: ScreenConfig) => c.type === type, updateEntity);
    }

    async updateMany(types: string[], updateEntity: (config: ScreenConfig) => ScreenConfig): Promise<number> {
        return this.repository.update((c: ScreenConfig) => types.includes(c.type), updateEntity);
    }

    async delete(type: string): Promise<void> {
        this.repository.delete((c: ScreenConfig) => c.type === type);
    }

    async deleteMany(types: string[]): Promise<void> {
        this.repository.delete((c: ScreenConfig) => types.includes(c.type));
    }
}
