import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import { DrawResultDto } from "./draw-result-dto";
import { toDrawResultDto, toDrawResult } from "./draw-result-mapper";
import { IDrawResultRepository } from "../../domain/repositories/draw-result-repository";

@injectable()
export class DrawResultService implements GasService {
  readonly serviceName = "DrawResultService";
  readonly functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IDrawResultRepository")
    private readonly repository: IDrawResultRepository
  ) {
    this.functions = {
      addDrawResults: this.addDrawResults.bind(this),
      addDrawResult: this.addDrawResult.bind(this),
      getAllDrawResults: this.getAllDrawResults.bind(this),
      deleteDrawResults: this.deleteDrawResults.bind(this),
    };
  }

  getAllDrawResults(): DrawResultDto[] {
    const results = this.repository.getDrawResults();
    return results.map(toDrawResultDto);
  }

  addDrawResult(args: { result: DrawResultDto }): void {
    this.repository.addDrawResults([toDrawResult(args.result)]);
  }

  addDrawResults(args: { results: DrawResultDto[] }): void {
    this.repository.addDrawResults(args.results.map(toDrawResult));
  }

  deleteDrawResults(args: { drawIds: string[] }): void {
    this.repository.deleteDrawResults(args.drawIds);
  }
}
