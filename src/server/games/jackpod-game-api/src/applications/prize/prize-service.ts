import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import { PrizeDto } from "./prize-dto";
import { toPrizeDto, toPrize } from "./prize-mapper";
import { IPrizeRepository } from "../../domain/prize/prize-repository";

@injectable()
export class PrizeService implements GasService {
  readonly serviceName = "PrizeService";
  readonly functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IPrizeRepository") private readonly repository: IPrizeRepository
  ) {
    this.functions = {
      getPrizes: this.getPrizes.bind(this),
      addPrizes: this.addPrizes.bind(this),
      updatePrizes: this.updatePrizes.bind(this),
      deletePrizes: this.deletePrizes.bind(this),
      batchOperations: this.batchOperations.bind(this),
    };
  }

  getPrizes(): PrizeDto[] {
    const prizes = this.repository.getPrizes();
    return prizes.map(toPrizeDto);
  }

  addPrizes(args: { prizes: PrizeDto[] }): void {
    const adds = args.prizes.map(toPrize);
    this.repository.addPrizes(adds);
  }

  updatePrizes(args: { updates: { id: string; prize: PrizeDto }[] }): void {
    const updates = args.updates.map((u) => ({
      id: u.id,
      updateFn: (_: any) => toPrize(u.prize),
    }));
    this.repository.updatePrizes(updates);
  }

  deletePrizes(args: { ids: string[] }): void {
    this.repository.deletePrizes(args.ids);
  }

  batchOperations(args: {
    adds: PrizeDto[];
    updates: { id: string; prize: PrizeDto }[];
    deletes: string[];
  }): void {
    if (args.adds.length > 0) {
      this.addPrizes({ prizes: args.adds });
    }
    if (args.updates.length > 0) {
      this.updatePrizes({ updates: args.updates });
    }
    if (args.deletes.length > 0) {
      this.deletePrizes({ ids: args.deletes });
    }
  }
}
