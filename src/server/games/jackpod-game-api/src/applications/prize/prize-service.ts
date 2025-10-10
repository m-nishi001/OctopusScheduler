import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import { PrizeDto } from "./prize-dto";
import { toPrizeDto, toPrize } from "./prize-mapper";
import { IPrizeRepository } from "../../domain/repositories/prize-repository";

@injectable()
export class PrizeService implements GasService {
  readonly serviceName = "PrizeService";
  readonly functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IPrizeRepository") private readonly repository: IPrizeRepository
  ) {
    this.functions = {
      getPrizeById: this.getPrizeById.bind(this),
      addPrizes: this.addPrizes.bind(this),
      updatePrizes: this.updatePrizes.bind(this),
      deletePrizes: this.deletePrizes.bind(this),
    };
  }

  getPrizeById(args: { id: string }): PrizeDto | null {
    const prize = this.repository.getPrizeById(args.id);
    return prize ? toPrizeDto(prize) : null;
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
}
