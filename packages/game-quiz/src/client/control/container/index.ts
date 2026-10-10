import { container, instanceCachingFactory } from "tsyringe";
import {
  IApiClientToken,
  IConcurrencyPolicyToken,
  createTypedApiClient,
} from "@octopus/infrastructures/interfaces";
import { PlatformApiClient } from "@octopus/infrastructures/platform-api-client";
import { PlatformConcurrencyPolicy } from "@octopus/infrastructures/platform-concurrency-policy";
import { SyncRunner } from "@octopus/sync-engine";
import {
  QUIZ_GAME_PREFIX,
  QUIZ_GAME_ENDPOINTS,
  IQuizGameApiToken,
} from "../../../server/quiz-api-contract";
import type { QuizGameApi } from "../../../server/quiz-api-contract";
import { QuizRepository } from "../../model/quiz-repository";
import { QuizService } from "../../model/quiz-service";
import { QuizRoundGateway } from "../../model/quiz-round-gateway";
import { StartQuizUseCase } from "../use-cases/start-quiz-use-case";
import { AddQuizUseCase } from "../use-cases/add-quiz-use-case";
import { UpdateQuizUseCase } from "../use-cases/update-quiz-use-case";
import { GetAllQuizzesUseCase } from "../use-cases/get-all-quizzes-use-case";
import { DeleteQuizUseCase } from "../use-cases/delete-quiz-use-case";
import { SyncService } from "../sync/sync-service";

export class Container {
  static register() {
    // ビルド対象(GAS/Cloudflare)ごとに @octopus/infrastructures/platform-api-client が
    // 解決する実装(Viteのresolve.conditions)を登録する。
    container.register(IApiClientToken, { useClass: PlatformApiClient });
    // 同期エンジンの並列度も同じ仕組みで環境ごとに切り替える。
    container.register(IConcurrencyPolicyToken, {
      useClass: PlatformConcurrencyPolicy,
    });
    container.register<QuizGameApi>(IQuizGameApiToken, {
      useFactory: instanceCachingFactory((c) =>
        createTypedApiClient<QuizGameApi>(
          c.resolve(IApiClientToken),
          QUIZ_GAME_PREFIX,
          QUIZ_GAME_ENDPOINTS
        )
      ),
    });

    container.register(QuizRepository, { useClass: QuizRepository });

    container.register(QuizRoundGateway, { useClass: QuizRoundGateway });
    container.register(QuizService, { useClass: QuizService });
    container.register(StartQuizUseCase, { useClass: StartQuizUseCase });
    container.register(AddQuizUseCase, { useClass: AddQuizUseCase });
    container.register(UpdateQuizUseCase, { useClass: UpdateQuizUseCase });
    container.register(GetAllQuizzesUseCase, {
      useClass: GetAllQuizzesUseCase,
    });
    container.register(DeleteQuizUseCase, { useClass: DeleteQuizUseCase });
    container.register(SyncRunner, { useClass: SyncRunner });
    container.register(SyncService, { useClass: SyncService });
  }
}
