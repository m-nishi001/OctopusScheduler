import type { Result } from '../../domains/result/Result';

export interface ResultRepository {
  getResult(drawId: string): Promise<Result | null>;
  getAllResults(): Promise<Result[]>;
}
