import { injectable, inject } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/IPrizeRepository";
import type { PrizeDto } from "./dto/prize-dto";
import { fromPrize, toPrize } from "./dto/prize-dto";

@injectable()
export class PrizeService {
  constructor(@inject("IPrizeRepository") private repo: IPrizeRepository) {}

  async fetchPrizes(): Promise<PrizeDto[]> {
    const prizes = await this.repo.getPrizes();
    return prizes.map(fromPrize);
  }

  async batchOperations(operations: {
    add: PrizeDto[];
    update: PrizeDto[];
    delete: string[];
  }): Promise<void> {
    const addEntities = operations.add.map(toPrize);
    await this.repo.addPrizes(addEntities);

    const updateOps = operations.update.map((dto) => ({
      id: dto.id,
      updateFn: (_: any) => toPrize(dto),
    }));
    await this.repo.updatePrizes(updateOps);

    await this.repo.deletePrizes(operations.delete);
  }
}
