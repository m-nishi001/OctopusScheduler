import { injectable, inject } from "tsyringe";
import { QuizRepository } from "../../domains/repositories/quiz-repository";

@injectable()
export class SyncQuizzesUseCase {
  constructor(@inject(QuizRepository) private quizRepository: QuizRepository) {}

  async execute(
    direction: "gas-to-local" | "local-to-gas",
    onProgress?: (message: string) => void
  ): Promise<void> {
    return await this.quizRepository.syncQuizzes(direction, onProgress);
  }
}
