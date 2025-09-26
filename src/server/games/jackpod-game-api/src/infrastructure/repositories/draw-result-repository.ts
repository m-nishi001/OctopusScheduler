
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

    async save(result: DrawResult): Promise<void> {
        this.repository.add(result);
    }
}
