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
      getPrizeById: this.getPrizeById.bind(this),
      addPrizes: this.addPrizes.bind(this),
      updatePrizes: this.updatePrizes.bind(this),
      deletePrizes: this.deletePrizes.bind(this),
    };
  }

  async getPrizeById(args: { id: string }): Promise<PrizeDto | null> {
    const prize = await this.repository.getPrizeById(args.id);
    return prize ? toPrizeDto(prize) : null;
  }

  async addPrizes(args: { prizes: PrizeDto[] }): Promise<void> {
    const adds = args.prizes.map(toPrize);
    await this.repository.addPrizes(adds);
  }

  async updatePrizes(args: {
    updates: { id: string; prize: PrizeDto }[];
  }): Promise<void> {
    const updates = args.updates.map((u) => ({
      id: u.id,
      updateFn: (_: any) => toPrize(u.prize),
    }));
    await this.repository.updatePrizes(updates);
  }

  async deletePrizes(args: { ids: string[] }): Promise<void> {
    await this.repository.deletePrizes(args.ids);
  }
}
