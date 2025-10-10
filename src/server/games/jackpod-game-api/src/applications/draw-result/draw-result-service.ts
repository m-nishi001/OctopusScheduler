import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import { DrawResultDto } from "./draw-result-dto";
import { toDrawResultDto, toDrawResult } from "./draw-result-mapper";
import { IDrawResultRepository } from "../../domain/draw/draw-result-repository";

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
      getDrawResults: this.getDrawResults.bind(this),
      deleteDrawResults: this.deleteDrawResults.bind(this),
    };
  }

  getDrawResults(): DrawResultDto[] {
    const results = this.repository.getDrawResults();
    return results.map(toDrawResultDto);
  }

  addDrawResults(args: { results: DrawResultDto[] }): void {
    this.repository.addDrawResults(args.results.map(toDrawResult));
  }

  deleteDrawResults(args: { drawIds: string[] }): void {
    this.repository.deleteDrawResults(args.drawIds);
  }
}
