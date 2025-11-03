// import { container } from "tsyringe";
import { container } from "tsyringe";
import { QuizRepository } from "../../model/domains/repositories/quiz-repository";
import { ResultAggregationService } from "../../model/domains/services/result-aggregation-service";
import { StopQuizUseCase } from "../../model/applications/use-cases/stop-quiz-use-case";
import { GetResultsUseCase } from "../../model/applications/use-cases/get-results-use-case";

export class Container {
  static register() {
    container.register(QuizRepository, { useClass: QuizRepository });
    container.register(ResultAggregationService, {
      useClass: ResultAggregationService,
    });
    container.register(StopQuizUseCase, { useClass: StopQuizUseCase });
    container.register(GetResultsUseCase, { useClass: GetResultsUseCase });
  }
}
