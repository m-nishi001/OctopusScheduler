
import { injectable } from "tsyringe";
import { IDrawResultRepository } from "../../domain/repositories/draw-result-repository";
import { DrawResult } from "../../domain/entities/draw-result";
import { ISpreadsheetService, SpreadsheetService } from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class DrawResultRepository implements IDrawResultRepository {
    private readonly repository: ISpreadsheetService<DrawResult>;
    private readonly sheetName = "DrawResults";

    constructor() {
        this.repository = SpreadsheetService.getService<DrawResult>(this.sheetName);
    }


    async findAll(): Promise<DrawResult[]> {
        return this.repository.find((r: DrawResult) => true);
    }

    async findById(drawId: string): Promise<DrawResult | null> {
        const results = this.repository.find((r: DrawResult) => r.drawId === drawId);
        return results.length > 0 ? results[0] : null;
    }

    async findManyByIds(ids: string[]): Promise<DrawResult[]> {
        return this.repository.find((r: DrawResult) => ids.includes(r.drawId));
    }

    async save(result: DrawResult): Promise<void> {
        this.repository.add(result);
    }

    async update(drawId: string, updateEntity: (result: DrawResult) => DrawResult): Promise<number> {
        return this.repository.update((r: DrawResult) => r.drawId === drawId, updateEntity);
    }

    async updateMany(ids: string[], updateEntity: (result: DrawResult) => DrawResult): Promise<number> {
        return this.repository.update((r: DrawResult) => ids.includes(r.drawId), updateEntity);
    }

    async delete(drawId: string): Promise<void> {
        this.repository.delete((r: DrawResult) => r.drawId === drawId);
    }

    async deleteMany(ids: string[]): Promise<void> {
        this.repository.delete((r: DrawResult) => ids.includes(r.drawId));
    }
}
