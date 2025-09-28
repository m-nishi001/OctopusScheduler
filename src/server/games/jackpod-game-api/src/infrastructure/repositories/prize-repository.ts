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

  save(prize: Prize): void {
    this.repository.add(prize);
  }

  update(id: string, updateEntity: (prize: Prize) => Prize): number {
    return this.repository.update((p: Prize) => p.id === id, updateEntity);
  }

  updateMany(ids: string[], updateEntity: (prize: Prize) => Prize): number {
    return this.repository.update(
      (p: Prize) => ids.includes(p.id),
      updateEntity
    );
  }

  delete(id: string): void {
    this.repository.delete((p: Prize) => p.id === id);
  }

  deleteMany(ids: string[]): void {
    this.repository.delete((p: Prize) => ids.includes(p.id));
  }
}
