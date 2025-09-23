import type { ResultResponse } from './ResultResponse';
import { resultApi } from '../infrastructures/api/resultApi';

export class ResultService {
  async getResult(drawId: string): Promise<ResultResponse> {
    return await resultApi.getResult(drawId);
  }
}
