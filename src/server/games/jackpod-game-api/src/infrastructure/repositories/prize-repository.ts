import { injectable } from "tsyringe";
import { IPrizeRepository } from "../../domain/prize/prize-repository";
import { Prize } from "../../domain/prize/prize";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class PrizeRepository implements IPrizeRepository {
  private readonly repository: ISpreadsheetService<Prize>;
  private readonly sheetName = "Prizes";

  constructor() {
    this.repository = SpreadsheetService.getService<Prize>(this.sheetName);
  }

  getPrizes(): Prize[] {
    return this.repository.find((p: Prize) => true);
  }

  getPrizeById(id: string): Prize | null {
    return this.repository.find((p: Prize) => p.id === id)[0] || null;
  }

  addPrizes(prizes: Prize[]): void {
    const transaction = this.repository.beginTransaction();
    transaction.addMany(prizes);
    transaction.commit();
  }

  updatePrizes(
    updates: { id: string; updateFn: (prize: Prize) => Prize }[]
  ): void {
    const transaction = this.repository.beginTransaction();
    for (const update of updates) {
      transaction.updateMany([update.id], update.updateFn);
    }
    transaction.commit();
  }

  deletePrizes(ids: string[]): void {
    const transaction = this.repository.beginTransaction();
    transaction.deleteMany(ids);
    transaction.commit();
  }
}
