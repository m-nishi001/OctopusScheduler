import { injectable, inject } from "tsyringe";
import type { QuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class StartQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(quizId: string): Promise<QuizDto | null> {
    const quiz = this.quizService.getQuizById(quizId);
    if (!quiz) return null;

    const options = await Promise.all(
      quiz.options.map(async (option) => ({
        text: option.text,
        color: option.color,
        image: option.imageId
          ? await this.quizService.getAsset(option.imageId)
          : null,
      }))
    );

    return {
      id: quiz.id,
      title: quiz.title,
      question: quiz.question,
      options,
      formUrl: quiz.formUrl,
      timeLimit: quiz.timeLimit,
    };
  }
}
