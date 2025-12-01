import { container } from "tsyringe";
import { QuizRepository } from "../../model/domains/repositories/quiz-repository";
import { QuizService } from "../../model/domains/services/quiz-service";
import { ResultService } from "../../model/domains/services/result-service";
import { StopQuizUseCase } from "../../model/applications/use-cases/stop-quiz-use-case";
import { GetResultsUseCase } from "../../model/applications/use-cases/get-results-use-case";
import { StartQuizUseCase } from "../../model/applications/use-cases/start-quiz-use-case";
import { AddQuizUseCase } from "../../model/applications/use-cases/add-quiz-use-case";
import { UpdateQuizUseCase } from "../../model/applications/use-cases/update-quiz-use-case";
import { GetAllQuizzesUseCase } from "../../model/applications/use-cases/get-all-quizzes-use-case";
import { DeleteQuizUseCase } from "../../model/applications/use-cases/delete-quiz-use-case";
import { UiQuizService } from "../../ui/pages/quiz-display/services/quiz-service";

export class Container {
  static register() {
    container.register(QuizRepository, { useClass: QuizRepository });
    container.register(QuizService, { useClass: QuizService });
    container.register(ResultService, {
      useClass: ResultService,
    });
    container.register(StopQuizUseCase, { useClass: StopQuizUseCase });
    container.register(GetResultsUseCase, { useClass: GetResultsUseCase });
    container.register(StartQuizUseCase, { useClass: StartQuizUseCase });
    container.register(AddQuizUseCase, { useClass: AddQuizUseCase });
    container.register(UpdateQuizUseCase, { useClass: UpdateQuizUseCase });
    container.register(GetAllQuizzesUseCase, {
      useClass: GetAllQuizzesUseCase,
    });
    container.register(DeleteQuizUseCase, { useClass: DeleteQuizUseCase });
    // UI-level quiz service for pages
    container.register(UiQuizService, { useClass: UiQuizService });
  }
}
