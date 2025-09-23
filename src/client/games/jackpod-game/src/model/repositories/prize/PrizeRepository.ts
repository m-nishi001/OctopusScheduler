import type { Prize } from '../../domains/prize/Prize';

export interface PrizeRepository {
  getPrizeById(id: string): Promise<Prize | null>;
  getAllPrizes(): Promise<Prize[]>;
}
