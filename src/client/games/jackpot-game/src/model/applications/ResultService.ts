import type { ResultResponse } from './ResultResponse';
import { ResultRepository } from '../infrastructures/repository/result-repository';

export class ResultService {
    private readonly repo = new ResultRepository();
    async getResult(drawId: string): Promise<ResultResponse> {
        return await this.repo.getResult(drawId);
    }
}
