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

    getAll(): DrawResultDto[] {
        const results = this.repository.findAll();
        return results.map(toDrawResultDto);
    }

    getById(args: { drawId: string }): DrawResultDto | null {
        const result = this.repository.findById(args.drawId);
        return result ? toDrawResultDto(result) : null;
    }

    save(args: { result: DrawResultDto }): void {
        this.repository.save(toDrawResult(args.result));
    }
}
