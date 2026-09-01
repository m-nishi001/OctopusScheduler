import { injectable, inject } from "tsyringe";
import type { DeleteQuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";

@injectable()
export class DeleteQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(dto: DeleteQuizDto): Promise<void> {
    await this.quizService.deleteQuiz(dto.id);
  }
}
