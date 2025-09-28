import { Result } from '../entities/result';

export interface ResultRepository {
  saveResult(result: Result): void;
  getResults(): Result[];
  findResultById(memberId: string, prizeId: string): Result | null;
  updateResult(memberId: string, prizeId: string, updateEntity: (result: Result) => Result): number;
  updateManyResults(ids: Array<{memberId: string, prizeId: string}>, updateEntity: (result: Result) => Result): number;
  deleteResult(memberId: string, prizeId: string): void;
  deleteManyResults(ids: Array<{memberId: string, prizeId: string}>): void;
}
