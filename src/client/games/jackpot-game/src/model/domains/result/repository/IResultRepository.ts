import type { ResultResponse } from '../../../applications/dto/result-response';

export interface IResultRepository {
  getResult(drawId: string): Promise<ResultResponse | null>;
}
