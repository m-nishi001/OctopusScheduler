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
      addDrawResult: this.addDrawResult.bind(this),
      getAllDrawResults: this.getAllDrawResults.bind(this),
      deleteDrawResults: this.deleteDrawResults.bind(this),
    };
  }

  async getAllDrawResults(): Promise<DrawResultDto[]> {
    const results = await this.repository.getDrawResults();
    return results.map(toDrawResultDto);
  }

  async addDrawResult(args: { result: DrawResultDto }): Promise<void> {
    await this.repository.addDrawResults([toDrawResult(args.result)]);
  }

  async addDrawResults(args: { results: DrawResultDto[] }): Promise<void> {
    await this.repository.addDrawResults(args.results.map(toDrawResult));
  }

  async deleteDrawResults(args: { drawIds: string[] }): Promise<void> {
    await this.repository.deleteDrawResults(args.drawIds);
  }
}
