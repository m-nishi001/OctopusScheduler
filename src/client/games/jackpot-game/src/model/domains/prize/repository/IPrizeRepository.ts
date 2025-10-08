import type { PrizeDto } from "../../../applications/dto/prize-dto";

export interface IPrizeRepository {
  fetchPrizes(): Promise<PrizeDto[]>;
  batchOperations(adds: PrizeDto[], updates: PrizeDto[], deletes: string[]): Promise<void>;
  syncPrizesWithServer(): Promise<PrizeDto[]>;
}
