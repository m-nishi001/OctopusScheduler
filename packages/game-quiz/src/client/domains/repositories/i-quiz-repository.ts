import type { Quiz } from "../entities/quiz";

export const IQuizRepositoryToken = Symbol("IQuizRepository");

export interface IQuizRepository {
  getQuizById(id: string): Promise<Quiz | null>;
  getAllQuizzes(): Promise<Quiz[]>;
  saveQuiz(quiz: Quiz): Promise<void>;
  addQuiz(quiz: Omit<Quiz, "id">): Promise<string>;
  deleteQuiz(id: string): Promise<void>;
  syncQuizzes(
    direction: "gas-to-local" | "local-to-gas",
    onProgress?: (message: string) => void
  ): Promise<{
    successCount: number;
    failedCount: number;
    failedFiles: string[];
  }>;
}
