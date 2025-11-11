import { injectable, inject } from "tsyringe";
import type { UpdateQuizDto } from "../dtos/quiz-dto";
import type { Quiz } from "../../domains/entities/quiz";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class UpdateQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(dto: UpdateQuizDto): Promise<void> {
    const updatedQuiz: Quiz = {
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
    };
    await this.quizService.updateQuiz(updatedQuiz);
  }
}
