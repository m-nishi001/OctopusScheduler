import { injectable, container } from "tsyringe";
import { StartQuizUseCase } from "../../../../model/applications/use-cases/start-quiz-use-case";
import { StopQuizUseCase } from "../../../../model/applications/use-cases/stop-quiz-use-case";
import type { QuizDto } from "../types/quiz-dto";

@injectable()
export class UiQuizService {
  async startQuiz(quizId: string): Promise<QuizDto | null> {
    const startQuizUseCase = container.resolve(
      StartQuizUseCase
    ) as StartQuizUseCase;
    return await startQuizUseCase.execute(quizId);
  }

  async stopQuiz(
    formId: string,
    quizStartTimeMs: number,
    answerKey: string,
    correctValue: string
  ): Promise<any[]> {
    const stopQuizUseCase = container.resolve(
      StopQuizUseCase
    ) as StopQuizUseCase;
    return await stopQuizUseCase.execute(
      formId,
      quizStartTimeMs,
      answerKey,
      correctValue
    );
  }
}
