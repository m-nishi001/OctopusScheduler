import type { Prize } from "../prize";
// no DriveMetadata import needed for the interface

export const IPrizeRepositoryToken = Symbol("IPrizeRepository");

export interface IPrizeRepository {
  getPrizes(): Promise<Prize[]>;
  getPrizeById(id: string): Promise<Prize | null>;
  addPrizes(prizes: Prize[]): Promise<void>;
  deletePrizes(ids: string[]): Promise<void>;
  replaceAllPrizes(prizes: Prize[]): Promise<{ replaced: number }>;
  exportAllPrizesToDrive(): Promise<void>;
  importAllPrizesFromDrive(): Promise<void>;
}
