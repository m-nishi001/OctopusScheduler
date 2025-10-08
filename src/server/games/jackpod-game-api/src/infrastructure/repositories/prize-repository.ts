import { injectable } from "tsyringe";
import { IPrizeRepository } from "../../domain/repositories/prize-repository";
import { Prize } from "../../domain/entities/prize";
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

  findAll(): Prize[] {
    return this.repository.find((p: Prize) => true);
  }

  findById(id: string): Prize | null {
    return this.repository.find((p: Prize) => p.id === id)[0] || null;
  }

  findManyByIds(ids: string[]): Prize[] {
    return this.repository.find((p: Prize) => ids.includes(p.id));
  }

  batchOperations(
    adds: Prize[],
    updates: { ids: string[]; updateFn: (prize: Prize) => Prize }[],
    deletes: string[]
  ): void {
    const transaction = this.repository.beginTransaction();
    transaction.addMany(adds);
    for (const update of updates) {
      transaction.updateMany(update.ids, update.updateFn);
    }
    transaction.deleteMany(deletes);
    transaction.commit();
  }
}
