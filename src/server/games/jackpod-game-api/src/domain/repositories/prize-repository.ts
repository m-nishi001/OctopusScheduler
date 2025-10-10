import { Prize } from "../../domain/entities/prize";

export interface IPrizeRepository {
  getPrizes(): Prize[];
  getPrizeById(id: string): Prize | null;
  addPrizes(prizes: Prize[]): void;
  updatePrizes(
    updates: { id: string; updateFn: (prize: Prize) => Prize }[]
  ): void;
  deletePrizes(ids: string[]): void;
}
