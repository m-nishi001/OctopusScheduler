
import { injectable, inject } from "tsyringe";
import { Result } from '../../domain/entities/result';
import { ResultRepository } from '../../domain/repositories/result-repository';
import { GasService } from "./gas-service";

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

    async saveResult(args: { result: Result }): Promise<void> {
        await this.repository.saveResult(args.result);
    }

    async getResults(): Promise<Result[]> {
        return await this.repository.getResults();
    }
}
