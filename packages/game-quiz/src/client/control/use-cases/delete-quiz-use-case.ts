import { injectable, inject } from "tsyringe";
import type { DeleteQuizDto } from "../dto/quiz-dto";
import { QuizService } from "../../model/quiz-service";

/** クイズを削除する。 */
@injectable()
export class DeleteQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(dto: DeleteQuizDto): Promise<void> {
    await this.quizService.deleteQuiz(dto.id);
  }
}
