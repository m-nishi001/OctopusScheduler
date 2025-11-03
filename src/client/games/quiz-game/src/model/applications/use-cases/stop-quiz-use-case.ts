import { injectable, inject } from "tsyringe";
import type { ResultDto } from "../dtos/result-dto";
import { ResultService } from "../../domains/services/result-service";

@injectable()
export class StopQuizUseCase {
  constructor(
    @inject(ResultService)
    private resultService: ResultService
  ) {}

  async execute(quizId: string): Promise<ResultDto[]> {
    const results = await this.resultService.aggregateResults(quizId);
    return results.map((result) => ({
      id: result.id,
      playerName: result.playerName,
      time: result.time,
      rank: result.rank,
    }));
  }
}
