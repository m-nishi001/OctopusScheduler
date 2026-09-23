import { container } from "tsyringe";
import { IApiClientToken } from "@octopus/infrastructures/interfaces";
import { GasApiClient } from "@octopus/infrastructures/gas/gas-api-client";
import { QuizRepository } from "../../model/quiz-repository";
import { FormRepository } from "../../model/form-repository";
import { QuizService } from "../../model/quiz-service";
import { ResultService } from "../../model/result-service";
import { StopQuizUseCase } from "../use-cases/stop-quiz-use-case";
import { GetResultsUseCase } from "../use-cases/get-results-use-case";
import { StartQuizUseCase } from "../use-cases/start-quiz-use-case";
import { AddQuizUseCase } from "../use-cases/add-quiz-use-case";
import { UpdateQuizUseCase } from "../use-cases/update-quiz-use-case";
import { GetAllQuizzesUseCase } from "../use-cases/get-all-quizzes-use-case";
import { DeleteQuizUseCase } from "../use-cases/delete-quiz-use-case";

export class Container {
  static register() {
    // GAS 用のインフラを登録する。将来 Cloudflare 等に切り替える場合は
    // ここを設定に応じて別実装(CloudflareApiClient 等)に差し替えるだけでよい。
    container.register(IApiClientToken, { useClass: GasApiClient });

    container.register(QuizRepository, { useClass: QuizRepository });
    container.register(FormRepository, { useClass: FormRepository });

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
