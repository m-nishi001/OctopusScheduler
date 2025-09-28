import type { ResultResponse } from './dto/result-response';
import { injectable, inject } from 'tsyringe';
import type { IResultRepository } from '../../model/domains/result/repository/IResultRepository';

@injectable()
export class ResultService {
    constructor(@inject("IResultRepository") private repo: IResultRepository) {}
    async getResult(drawId: string): Promise<ResultResponse | null> {
        const result = await this.repo.getResult(drawId);
        if (!result) return null;
        return result;
    }
}
