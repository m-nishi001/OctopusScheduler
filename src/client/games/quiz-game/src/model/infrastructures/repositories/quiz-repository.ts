import { injectable } from "tsyringe";
import type { Quiz } from "../../domains/entities/quiz";
import { LocalStorageService } from "packages/common-lib/storage/local-storage-service";

@injectable()
export class QuizRepository {
  private readonly localStorage = new LocalStorageService(
    "quiz-game",
    "QuizData"
  );

  async getQuizById(id: string): Promise<Quiz | null> {
    return (await this.localStorage.get<Quiz>(id)) || null;
  }

  async saveQuiz(quiz: Quiz): Promise<void> {
    await this.localStorage.save(quiz.id, quiz);
  }
}
