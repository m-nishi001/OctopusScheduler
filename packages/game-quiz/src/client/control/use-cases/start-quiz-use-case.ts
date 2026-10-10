import { injectable, inject } from "tsyringe";
import type { QuizDto } from "../dto/quiz-dto";
import { QuizService } from "../../model/quiz-service";
import { SyncService } from "../sync/sync-service";

@injectable()
export class StartQuizUseCase {
  constructor(
    @inject(QuizService) private quizService: QuizService,
    @inject(SyncService) private syncService: SyncService
  ) {}

  async execute(quizId: string): Promise<QuizDto | null> {
    let quiz = await this.quizService.getQuizById(quizId);
    if (!quiz) {
      // 投影用のホスト端末は設定を作った端末とは限らない。この端末に無ければ Drive から取り込んで再取得する。
      try {
        await this.syncService.syncAll();
        quiz = await this.quizService.getQuizById(quizId);
      } catch (e) {
        console.error("Failed to sync quizzes", e);
      }
    }
    if (!quiz) return null;
    return {
      id: quiz.id,
      title: quiz.title,
      question: quiz.question,
      correctNo: quiz.correctNo ?? 1,
      timeLimit: quiz.timeLimit,
      options: quiz.options,
      bgm: quiz.bgm,
      settings: quiz.settings,
    };
  }
}
