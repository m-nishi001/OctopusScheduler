import { container } from "tsyringe";
import { QuizRepository } from "../../model/domains/repositories/quiz-repository";
import { ResultService } from "../../model/domains/services/result-service";
import { StopQuizUseCase } from "../../model/applications/use-cases/stop-quiz-use-case";
import { GetResultsUseCase } from "../../model/applications/use-cases/get-results-use-case";
import { StartQuizUseCase } from "../../model/applications/use-cases/start-quiz-use-case";

export class Container {
  static register() {
    container.register(QuizRepository, { useClass: QuizRepository });
    container.register(ResultService, {
      useClass: ResultService,
    });
    container.register(StopQuizUseCase, { useClass: StopQuizUseCase });
    container.register(GetResultsUseCase, { useClass: GetResultsUseCase });
    container.register(StartQuizUseCase, { useClass: StartQuizUseCase });
  }
}
