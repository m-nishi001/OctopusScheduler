import { injectable, inject } from "tsyringe";
import type { UpdateQuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";
import { SyncQuizzesUseCase } from "./sync-quizzes-use-case";

@injectable()
export class UpdateQuizUseCase {
  constructor(
    @inject(QuizService) private quizService: QuizService,
    @inject(SyncQuizzesUseCase) private syncQuizzesUseCase: SyncQuizzesUseCase
  ) {}

  async execute(dto: UpdateQuizDto): Promise<void> {
    const quiz = await this.quizService.getQuizById(dto.id);
    if (!quiz) throw new Error("Quiz not found");

    const updatedQuiz = {
      ...quiz,
      title: dto.title,
      question: dto.question,
      options: dto.options,
      formUrl: dto.formUrl,
      timeLimit: dto.timeLimit,
      bgm: dto.bgm,
    };

    await this.quizService.updateQuiz(updatedQuiz);
    // Sync to GAS
    await this.syncQuizzesUseCase.execute("local-to-gas");
  }
}
