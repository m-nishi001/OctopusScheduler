
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


    findAll(): DrawResult[] {
        return this.repository.find((r: DrawResult) => true);
    }

    findById(drawId: string): DrawResult | null {
        const results = this.repository.find((r: DrawResult) => r.drawId === drawId);
        return results.length > 0 ? results[0] : null;
    }

    findManyByIds(ids: string[]): DrawResult[] {
        return this.repository.find((r: DrawResult) => ids.includes(r.drawId));
    }

    save(result: DrawResult): void {
        this.repository.add(result);
    }

    update(drawId: string, updateEntity: (result: DrawResult) => DrawResult): number {
        return this.repository.update((r: DrawResult) => r.drawId === drawId, updateEntity);
    }

    updateMany(ids: string[], updateEntity: (result: DrawResult) => DrawResult): number {
        return this.repository.update((r: DrawResult) => ids.includes(r.drawId), updateEntity);
    }

    delete(drawId: string): void {
        this.repository.delete((r: DrawResult) => r.drawId === drawId);
    }

    deleteMany(ids: string[]): void {
        this.repository.delete((r: DrawResult) => ids.includes(r.drawId));
    }
}
