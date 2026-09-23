import { injectable, inject } from "tsyringe";
import { IQuizRepositoryToken } from "../../domains/repositories/i-quiz-repository";
import type { IQuizRepository } from "../../domains/repositories/i-quiz-repository";

export type SyncSummary = {
  successCount: number;
  failedCount: number;
  failedFiles: string[];
};

@injectable()
export class SyncQuizzesUseCase {
  constructor(
    @inject(IQuizRepositoryToken) private quizRepository: IQuizRepository
  ) {}

  async execute(
    direction: "gas-to-local" | "local-to-gas",
    onProgress?: (message: string) => void
  ): Promise<SyncSummary> {
    return await this.quizRepository.syncQuizzes(direction, onProgress);
  }
}
