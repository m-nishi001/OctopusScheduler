import { injectable, inject } from "tsyringe";
import type { ResultDto } from "../dtos/result-dto";
import { ResultAggregationService } from "../../domains/services/result-aggregation-service";

@injectable()
export class StopQuizUseCase {
  constructor(
    @inject(ResultAggregationService)
    private aggregationService: ResultAggregationService
  ) {}

  async execute(quizId: string): Promise<ResultDto[]> {
    const results = await this.aggregationService.aggregateResults(quizId);
    return results.map((result) => ({
      id: result.id,
      player: result.player,
      time: result.time,
      rank: result.rank,
    }));
  }
}
