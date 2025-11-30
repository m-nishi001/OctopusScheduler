import { injectable, inject } from "tsyringe";
import type { UpdateQuizDto } from "../dtos/quiz-dto";
import { Quiz } from "../../domains/entities/quiz";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class UpdateQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(dto: UpdateQuizDto): Promise<void> {
    const updatedQuiz = {
      id: dto.id,
      title: dto.title,
      question: dto.question,
      options: dto.options.map((o) => ({
        no: o.no,
        text: o.text,
        color: o.color,
        image: o.image,
      })),
      formUrl: dto.answerUrl,
      timeLimit: dto.timeLimit,
      bgm: dto.bgm,
      correctNo: dto.correctNo ?? 1,
      settings: dto.settings
        ? {
            correctBgm: dto.settings.correctBgm ?? null,
            prizeImage: dto.settings.prizeImage ?? null,
            prizeName: dto.settings.prizeName ?? null,
            prizeBgm: dto.settings.prizeBgm ?? null,
          }
        : undefined,
    };

    const quizInstance = new Quiz(updatedQuiz);

    await this.quizService.updateQuiz(quizInstance);
  }
}
