import { injectable } from "tsyringe";
import { IDrawResultRepository } from "../../domain/draw/draw-result-repository";
import { DrawResult } from "../../domain/draw/draw-result";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class DrawResultRepository implements IDrawResultRepository {
  private readonly repository: ISpreadsheetService<DrawResult>;
  private readonly sheetName = "DrawResults";

  constructor() {
    this.repository = SpreadsheetService.getService<DrawResult>(this.sheetName);
  }

  getDrawResults(): DrawResult[] {
    return this.repository.find(() => true);
  }

  getDrawResultById(drawId: string): DrawResult | null {
    const results = this.repository.find(
      (r: DrawResult) => r.drawId === drawId
    );
    return results.length > 0 ? results[0] : null;
  }

  updateDrawResults(results: DrawResult[]): void {
    const transaction = this.repository.beginTransaction();
    for (const result of results) {
      transaction.update(
        (r: DrawResult) => r.drawId === result.drawId,
        () => result
      );
    }
    transaction.commit();
  }

  deleteDrawResults(drawIds: string[]): void {
    for (const drawId of drawIds) {
      this.repository.delete((r: DrawResult) => r.drawId === drawId);
    }
  }

  addDrawResults(results: DrawResult[]): void {
    const transaction = this.repository.beginTransaction();
    for (const result of results) {
      transaction.add(result);
    }
    transaction.commit();
  }
}
