import { container, instanceCachingFactory } from "tsyringe";
import { IApiClientToken, createTypedApiClient } from "@octopus/infrastructures/interfaces";
import { GasApiClient } from "@octopus/infrastructures/gas/gas-api-client";
import {
  QUIZ_GAME_PREFIX,
  QUIZ_GAME_ENDPOINTS,
  IQuizGameApiToken,
} from "../../../server/quiz-api-contract";
import type { QuizGameApi } from "../../../server/quiz-api-contract";
import { QuizRepository } from "../../model/quiz-repository";
import { MemberRepository } from "../../model/member-repository";
import { ParticipantAuthRepository } from "../../model/participant-auth-repository";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import { QuizService } from "../../model/quiz-service";
import { StartQuizUseCase } from "../use-cases/start-quiz-use-case";
import { AddQuizUseCase } from "../use-cases/add-quiz-use-case";
import { UpdateQuizUseCase } from "../use-cases/update-quiz-use-case";
import { GetAllQuizzesUseCase } from "../use-cases/get-all-quizzes-use-case";
import { DeleteQuizUseCase } from "../use-cases/delete-quiz-use-case";
import { ListMembersUseCase } from "../use-cases/list-members-use-case";
import { AddMemberUseCase } from "../use-cases/add-member-use-case";
import { UpdateMemberUseCase } from "../use-cases/update-member-use-case";
import { DeleteMemberUseCase } from "../use-cases/delete-member-use-case";
import { LoginParticipantUseCase } from "../use-cases/login-participant-use-case";
import { ResolveDeviceTokenUseCase } from "../use-cases/resolve-device-token-use-case";
import { StartAcceptingAnswersUseCase } from "../use-cases/start-accepting-answers-use-case";
import { StopAcceptingAnswersUseCase } from "../use-cases/stop-accepting-answers-use-case";
import { GetAcceptanceStateUseCase } from "../use-cases/get-acceptance-state-use-case";
import { SubmitAnswerUseCase } from "../use-cases/submit-answer-use-case";
import { GetSubmittedAnswersUseCase } from "../use-cases/get-submitted-answers-use-case";

export class Container {
  static register() {
    // GAS 用のインフラを登録する。将来 Cloudflare 等に切り替える場合は
    // ここを設定に応じて別実装(CloudflareApiClient 等)に差し替えるだけでよい。
    container.register(IApiClientToken, { useClass: GasApiClient });
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
    container.register(MemberRepository, { useClass: MemberRepository });
    container.register(ParticipantAuthRepository, { useClass: ParticipantAuthRepository });
    container.register(AnswerSessionRepository, { useClass: AnswerSessionRepository });

    container.register(QuizService, { useClass: QuizService });
    container.register(StartQuizUseCase, { useClass: StartQuizUseCase });
    container.register(AddQuizUseCase, { useClass: AddQuizUseCase });
    container.register(UpdateQuizUseCase, { useClass: UpdateQuizUseCase });
    container.register(GetAllQuizzesUseCase, {
      useClass: GetAllQuizzesUseCase,
    });
    container.register(DeleteQuizUseCase, { useClass: DeleteQuizUseCase });
    container.register(ListMembersUseCase, { useClass: ListMembersUseCase });
    container.register(AddMemberUseCase, { useClass: AddMemberUseCase });
    container.register(UpdateMemberUseCase, { useClass: UpdateMemberUseCase });
    container.register(DeleteMemberUseCase, { useClass: DeleteMemberUseCase });
    container.register(LoginParticipantUseCase, { useClass: LoginParticipantUseCase });
    container.register(ResolveDeviceTokenUseCase, { useClass: ResolveDeviceTokenUseCase });
    container.register(StartAcceptingAnswersUseCase, {
      useClass: StartAcceptingAnswersUseCase,
    });
    container.register(StopAcceptingAnswersUseCase, { useClass: StopAcceptingAnswersUseCase });
    container.register(GetAcceptanceStateUseCase, { useClass: GetAcceptanceStateUseCase });
    container.register(SubmitAnswerUseCase, { useClass: SubmitAnswerUseCase });
    container.register(GetSubmittedAnswersUseCase, { useClass: GetSubmittedAnswersUseCase });
  }
}
