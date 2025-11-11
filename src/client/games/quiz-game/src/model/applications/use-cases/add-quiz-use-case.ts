import { injectable, inject } from "tsyringe";
import type { AddQuizDto } from "../dtos/quiz-dto";
import type { Quiz } from "../../domains/entities/quiz";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class AddQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(dto: AddQuizDto): Promise<string> {
    const quizData: Omit<Quiz, "id"> = {
      title: dto.title,
      question: dto.question,
      formUrl: dto.answerUrl,
      timeLimit: dto.timeLimit,
      options: dto.options.map((o) => ({
        no: o.no,
        text: o.text,
        color: o.color,
        image: o.image,
      })),
      bgm: dto.bgm,
    };
    const id = await this.quizService.addQuiz(quizData);
    return id;
  }
}
