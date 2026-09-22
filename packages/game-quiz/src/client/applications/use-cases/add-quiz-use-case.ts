import { injectable, inject } from "tsyringe";
import type { AddQuizDto } from "../dtos/quiz-dto";
import { Quiz } from "../../domains/entities/quiz";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class AddQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(dto: AddQuizDto): Promise<string> {
    const quizData = {
      title: dto.title,
      question: dto.question,
      formUrl: dto.answerUrl,
      answerFormId: dto.answerFormId,
      timeLimit: dto.timeLimit,
      options: dto.options.map((o) => ({
        no: o.no,
        text: o.text,
        color: o.color,
        image: o.image,
      })),
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

    const id = await this.quizService.addQuiz(new Quiz(quizData));
    return id;
  }
}
