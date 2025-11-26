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
      answerUrl: quiz.formUrl,
      answerFormId:
        typeof (quiz as any).getFormId === "function"
          ? (quiz as any).getFormId()
          : null,
      correctNo: (quiz as any).correctNo ?? 1,
      timeLimit: quiz.timeLimit,
      options: quiz.options,
      bgm: quiz.bgm,
    };
  }
}
