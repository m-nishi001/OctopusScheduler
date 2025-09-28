import { injectable, inject } from "tsyringe";
import { ResultRepository } from '../../domain/repositories/result-repository';
import { GasService } from "./gas-service";
import { ResultDto } from '../dtos/result-dto';
import { toResultDto, toResult } from '../dtos/result-mapper';

@injectable()
export class ResultService implements GasService {
    public serviceName = "ResultService";
    public functions: Record<string, (args: any) => any>;

    constructor(@inject("IResultRepository") private readonly repository: ResultRepository) {
        this.functions = {
            saveResult: this.saveResult.bind(this),
            getResults: this.getResults.bind(this)
        };
    }

    async saveResult(args: { result: ResultDto }): Promise<void> {
        await this.repository.saveResult(toResult(args.result));
    }

    async getResults(): Promise<ResultDto[]> {
        const results = await this.repository.getResults();
        return results.map(toResultDto);
    }
}
