import { injectable, inject } from "tsyringe";
import type { QuizDto } from "../dto/quiz-dto";
import { QuizService } from "../../model/quiz-service";

@injectable()
export class StartQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(quizId: string): Promise<QuizDto | null> {
    const quiz = await this.quizService.getQuizById(quizId);
    if (!quiz) return null;
    return {
      id: quiz.id,
      title: quiz.title,
      question: quiz.question,
      correctNo: quiz.correctNo ?? 1,
      timeLimit: quiz.timeLimit,
      options: quiz.options,
      bgm: quiz.bgm,
      settings: quiz.settings,
    };
  }
}
