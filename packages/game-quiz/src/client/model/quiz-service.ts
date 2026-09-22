import { injectable } from "tsyringe";
import type { Quiz } from "./quiz";
import { QuizRepository } from "./quiz-repository";

@injectable()
export class QuizService {
  constructor(private readonly quizRepo: QuizRepository) {}

  async getQuizById(id: string): Promise<Quiz | null> {
    return await this.quizRepo.getQuizById(id);
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    return await this.quizRepo.getAllQuizzes();
  }

  async addQuiz(quiz: Omit<Quiz, "id">): Promise<string> {
    return await this.quizRepo.addQuiz(quiz);
  }

  async updateQuiz(quiz: Quiz): Promise<void> {
    return await this.quizRepo.saveQuiz(quiz);
  }

  async deleteQuiz(id: string): Promise<void> {
    return await this.quizRepo.deleteQuiz(id);
  }
}
