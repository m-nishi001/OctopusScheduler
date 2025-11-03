import { injectable, inject } from "tsyringe";
import type { ResultDto } from "../dtos/result-dto";
import { StopQuizUseCase } from "./stop-quiz-use-case";

@injectable()
export class GetResultsUseCase {
  constructor(
    @inject(StopQuizUseCase) private stopQuizUseCase: StopQuizUseCase
  ) {}

  async execute(quizId: string): Promise<ResultDto[]> {
    // 集計結果を取得（StopQuizUseCaseを再利用）
    return await this.stopQuizUseCase.execute(quizId);
  }
}
