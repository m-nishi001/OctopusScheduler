import { injectable, inject } from "tsyringe";
import type { QuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class StartQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  execute(quizId: string): QuizDto | null {
    const quiz = this.quizService.getQuizById(quizId);
    return quiz
      ? {
          id: quiz.id,
          title: quiz.title,
          question: quiz.question,
          options: quiz.options,
          formUrl: quiz.formUrl,
          spreadsheetUrl: quiz.spreadsheetUrl,
          timeLimit: quiz.timeLimit,
        }
      : null;
  }
}
