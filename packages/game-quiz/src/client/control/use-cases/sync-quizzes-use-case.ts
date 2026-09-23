import { injectable, inject } from "tsyringe";
import { QuizRepository } from "../../model/quiz-repository";

export type SyncSummary = {
  successCount: number;
  failedCount: number;
  failedFiles: string[];
};

@injectable()
export class SyncQuizzesUseCase {
  constructor(
    @inject(QuizRepository) private readonly quizRepository: QuizRepository
  ) {}

  async execute(
    direction: "gas-to-local" | "local-to-gas",
    onProgress?: (message: string) => void
  ): Promise<SyncSummary> {
    return await this.quizRepository.syncQuizzes(direction, onProgress);
  }
}
