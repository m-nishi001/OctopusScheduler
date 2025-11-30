import { injectable, inject } from "tsyringe";
import type { QuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class GetAllQuizzesUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(): Promise<QuizDto[]> {
    const quizzes = await this.quizService.getAllQuizzes();
    return quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      question: quiz.question,
      answerUrl: quiz.formUrl,
      correctNo: (quiz as any).correctNo ?? 1,
      timeLimit: quiz.timeLimit,
      bgm: quiz.bgm,
      options: quiz.options.map((o) => ({
        no: o.no,
        text: o.text,
        color: o.color,
        image: o.image,
      })),
      settings: quiz.settings
        ? {
            // Assert to `Blob | null` since client-side expects Blob instances.
            correctBgm: quiz.settings.correctBgm,
            prizeImage: quiz.settings.prizeImage,
            prizeName: quiz.settings.prizeName ?? null,
            prizeBgm: quiz.settings.prizeBgm,
          }
        : undefined,
    }));
  }
}
