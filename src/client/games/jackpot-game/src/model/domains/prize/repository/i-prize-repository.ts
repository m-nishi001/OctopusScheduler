import type { Prize } from "../prize";

export interface IPrizeRepository {
  getPrizes(): Promise<Prize[]>;
  getPrizeById(id: string): Promise<Prize | null>;
  addPrizes(prizes: Prize[]): Promise<void>;
  updatePrizes(
    updates: { id: string; updateFn: (prize: Prize) => Prize }[]
  ): Promise<void>;
  deletePrizes(ids: string[]): Promise<void>;
  syncPrizes(): Promise<void>;
}
