import { injectable, inject } from "tsyringe";
import type { DeleteQuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";
import { SyncQuizzesUseCase } from "./sync-quizzes-use-case";

@injectable()
export class DeleteQuizUseCase {
  constructor(
    @inject(QuizService) private quizService: QuizService,
    @inject(SyncQuizzesUseCase) private syncQuizzesUseCase: SyncQuizzesUseCase
  ) {}

  async execute(dto: DeleteQuizDto): Promise<void> {
    await this.quizService.deleteQuiz(dto.id);
    // Sync to GAS
    await this.syncQuizzesUseCase.execute("local-to-gas");
  }
}
