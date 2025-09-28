import type { ResultResponse } from './dto/result-response';
import { ResultRepository } from '../../model/infrastructures/repository/result-repository';

export class ResultService {
    private readonly repo = new ResultRepository();
    async getResult(drawId: string): Promise<ResultResponse | null> {
        const result = await this.repo.getResult(drawId);
        if (!result) return null;
        return result;
    }
}
