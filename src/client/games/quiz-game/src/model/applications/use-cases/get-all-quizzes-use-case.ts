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
      timeLimit: quiz.timeLimit,
      bgm: quiz.bgm,
      options: quiz.options.map((o, index) => ({
        no: index + 1,
        text: o.text,
        color: o.color,
        image: o.image,
      })),
    }));
  }
}
