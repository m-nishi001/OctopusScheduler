import { injectable, inject } from "tsyringe";
import type { QuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";

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
      options: quiz.options,
      formUrl: quiz.formUrl,
      timeLimit: quiz.timeLimit,
    };
  }
}
