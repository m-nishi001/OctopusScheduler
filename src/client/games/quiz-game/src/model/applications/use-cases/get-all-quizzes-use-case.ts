import { injectable, inject } from "tsyringe";
import type { QuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";
import { SyncQuizzesUseCase } from "./sync-quizzes-use-case";

@injectable()
export class GetAllQuizzesUseCase {
  constructor(
    @inject(QuizService) private quizService: QuizService,
    @inject(SyncQuizzesUseCase) private syncQuizzesUseCase: SyncQuizzesUseCase
  ) {}

  async execute(): Promise<QuizDto[]> {
    // Sync from GAS to local first
    await this.syncQuizzesUseCase.execute("gas-to-local");

    const quizzes = await this.quizService.getAllQuizzes();
    return quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      question: quiz.question,
      options: quiz.options,
      formUrl: quiz.formUrl,
      timeLimit: quiz.timeLimit,
      bgm: quiz.bgm,
    }));
  }
}
