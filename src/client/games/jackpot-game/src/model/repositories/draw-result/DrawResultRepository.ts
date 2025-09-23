import type { DrawResult } from '../../domains/draw-result/DrawResult';

export interface DrawResultRepository {
  getDrawResultById(id: string): Promise<DrawResult | null>;
  getAllDrawResults(): Promise<DrawResult[]>;
}
