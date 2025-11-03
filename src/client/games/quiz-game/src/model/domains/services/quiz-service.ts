import { injectable, inject } from "tsyringe";
import type { Quiz } from "../entities/quiz";
import { QuizRepository } from "../repositories/quiz-repository";

@injectable()
export class QuizService {
  private quizRepo: QuizRepository;

  constructor(@inject(QuizRepository) quizRepo: QuizRepository) {
    this.quizRepo = quizRepo;
  }

  async getQuizById(id: string): Promise<Quiz | null> {
    return await this.quizRepo.getQuizById(id);
  }
}
