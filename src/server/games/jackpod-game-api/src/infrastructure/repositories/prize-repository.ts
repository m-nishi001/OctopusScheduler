
import { injectable } from "tsyringe";
import { IPrizeRepository } from "../../domain/repositories/prize-repository";
import { Prize } from "../../domain/entities/prize";
import { ISpreadsheetService, SpreadsheetService } from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class PrizeRepository implements IPrizeRepository {
    private readonly repository: ISpreadsheetService<Prize>;
    private readonly sheetName = "Prizes";

    constructor() {
        this.repository = SpreadsheetService.getService<Prize>(this.sheetName);
    }


    async findAll(): Promise<Prize[]> {
        return this.repository.find((p: Prize) => true);
    }

    async findById(id: string): Promise<Prize | null> {
        return this.repository.find((p: Prize) => p.id === id)[0] || null;
    }

    async findManyByIds(ids: string[]): Promise<Prize[]> {
        return this.repository.find((p: Prize) => ids.includes(p.id));
    }

    async save(prize: Prize): Promise<void> {
        this.repository.add(prize);
    }

    async update(id: string, updateEntity: (prize: Prize) => Prize): Promise<number> {
        return this.repository.update((p: Prize) => p.id === id, updateEntity);
    }

    async updateMany(ids: string[], updateEntity: (prize: Prize) => Prize): Promise<number> {
        return this.repository.update((p: Prize) => ids.includes(p.id), updateEntity);
    }

    async delete(id: string): Promise<void> {
        this.repository.delete((p: Prize) => p.id === id);
    }

    async deleteMany(ids: string[]): Promise<void> {
        this.repository.delete((p: Prize) => ids.includes(p.id));
    }
}
