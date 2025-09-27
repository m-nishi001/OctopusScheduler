import { Result } from '../entities/result';

export interface ResultRepository {
  saveResult(result: Result): Promise<void>;
  getResults(): Promise<Result[]>;
  findResultById(memberId: string, prizeId: string): Promise<Result | null>;
  updateResult(memberId: string, prizeId: string, updateEntity: (result: Result) => Result): Promise<number>;
  updateManyResults(ids: Array<{memberId: string, prizeId: string}>, updateEntity: (result: Result) => Result): Promise<number>;
  deleteResult(memberId: string, prizeId: string): Promise<void>;
  deleteManyResults(ids: Array<{memberId: string, prizeId: string}>): Promise<void>;
}
