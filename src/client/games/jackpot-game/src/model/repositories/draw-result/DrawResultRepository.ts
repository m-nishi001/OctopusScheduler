import type { LotteryResult } from '../../domains/draw-result/DrawResult';

export interface DrawResultRepository {
  getDrawResultById(id: string): Promise<LotteryResult | null>;
  getAllDrawResults(): Promise<LotteryResult[]>;
}
