import { injectable, inject } from "tsyringe";
import type { AddQuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class AddQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(dto: AddQuizDto): Promise<string> {
    return await this.quizService.addQuiz(dto);
  }
}
