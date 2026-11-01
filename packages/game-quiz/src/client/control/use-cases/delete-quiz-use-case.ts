import { injectable, inject } from "tsyringe";
import type { DeleteQuizDto } from "../dto/quiz-dto";
import { QuizService } from "../../model/quiz-service";

/** クイズを削除する(複数でも一覧の書き込みは1回)。 */
@injectable()
export class DeleteQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(dto: DeleteQuizDto): Promise<void> {
    await this.quizService.deleteQuizzes(dto.ids);
  }
}
