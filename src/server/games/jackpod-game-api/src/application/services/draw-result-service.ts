import { injectable, inject } from "tsyringe";
import { IDrawResultRepository } from "../../domain/repositories/draw-result-repository";
import { GasService } from "./gas-service";
import { DrawResultDto } from '../dtos/draw-result-dto';
import { toDrawResultDto, toDrawResult } from '../dtos/draw-result-mapper';

@injectable()
export class DrawResultService implements GasService {
    readonly serviceName = "DrawResultService";
    readonly functions: Record<string, (args: any) => any>;

    constructor(@inject("IDrawResultRepository") private readonly repository: IDrawResultRepository) {
        this.functions = {
            getAll: this.getAll.bind(this),
            getById: this.getById.bind(this),
            save: this.save.bind(this)
        };
    }

    async getAll(): Promise<DrawResultDto[]> {
        const results = await this.repository.findAll();
        return results.map(toDrawResultDto);
    }

    async getById(args: { drawId: string }): Promise<DrawResultDto | null> {
        const result = await this.repository.findById(args.drawId);
        return result ? toDrawResultDto(result) : null;
    }

    async save(args: { result: DrawResultDto }): Promise<void> {
        return this.repository.save(toDrawResult(args.result));
    }
}
