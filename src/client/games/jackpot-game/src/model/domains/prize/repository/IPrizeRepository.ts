import type { PrizeDto } from "../../../applications/dto/prize-dto";

export interface IPrizeRepository {
  fetchPrizes(): Promise<PrizeDto[]>;
  addPrize(prize: PrizeDto): Promise<void>;
  updatePrize(prize: PrizeDto): Promise<void>;
  deletePrize(prizeId: string): Promise<void>;
  syncPrizesWithServer(): Promise<PrizeDto[]>;
}
