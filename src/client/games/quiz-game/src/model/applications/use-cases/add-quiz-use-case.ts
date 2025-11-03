import { injectable, inject } from "tsyringe";
import type { AddQuizDto } from "../dtos/quiz-dto";
import { QuizService } from "../../domains/services/quiz-service";
import { SyncQuizzesUseCase } from "./sync-quizzes-use-case";

@injectable()
export class AddQuizUseCase {
  constructor(
    @inject(QuizService) private quizService: QuizService,
    @inject(SyncQuizzesUseCase) private syncQuizzesUseCase: SyncQuizzesUseCase
  ) {}

  async execute(dto: AddQuizDto): Promise<string> {
    const id = await this.quizService.addQuiz(dto);
    // Sync to GAS
    await this.syncQuizzesUseCase.execute("local-to-gas");
    return id;
  }
}
