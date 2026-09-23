import { container } from "tsyringe";
import { IApiClientToken } from "@octopus/infrastructures/interfaces";
import { GasApiClient } from "@octopus/infrastructures/gas/gas-api-client";
import { IQuizRepositoryToken } from "../../domains/repositories/i-quiz-repository";
import { IFormRepositoryToken } from "../../domains/repositories/i-form-repository";
import { IQuizAssetRepositoryToken } from "../../domains/repositories/i-quiz-asset-repository";
import { QuizRepository } from "../../infrastructures/quiz-repository";
import { FormRepository } from "../../infrastructures/form-repository";
import { QuizAssetRepository } from "../../infrastructures/quiz-asset-repository";
import { QuizService } from "../../domains/services/quiz-service";
import { ResultService } from "../../domains/services/result-service";
import { StopQuizUseCase } from "../../applications/use-cases/stop-quiz-use-case";
import { GetResultsUseCase } from "../../applications/use-cases/get-results-use-case";
import { StartQuizUseCase } from "../../applications/use-cases/start-quiz-use-case";
import { AddQuizUseCase } from "../../applications/use-cases/add-quiz-use-case";
import { UpdateQuizUseCase } from "../../applications/use-cases/update-quiz-use-case";
import { GetAllQuizzesUseCase } from "../../applications/use-cases/get-all-quizzes-use-case";
import { DeleteQuizUseCase } from "../../applications/use-cases/delete-quiz-use-case";

export class Container {
  static register() {
    // GAS 用のインフラを登録する。将来 Cloudflare 等に切り替える場合は
    // ここを設定に応じて別実装(CloudflareApiClient 等)に差し替えるだけでよい。
    container.register(IApiClientToken, { useClass: GasApiClient });

    container.register(IQuizRepositoryToken, { useClass: QuizRepository });
    container.register(IFormRepositoryToken, { useClass: FormRepository });
    container.register(IQuizAssetRepositoryToken, {
      useClass: QuizAssetRepository,
    });

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
  }
}
