import { injectable, inject } from "tsyringe";
import type { QuizDto } from "../dto/quiz-dto";
import { QuizService } from "../../model/quiz-service";

@injectable()
export class StartQuizUseCase {
  constructor(@inject(QuizService) private quizService: QuizService) {}

  async execute(quizId: string): Promise<QuizDto | null> {
    const quiz = await this.quizService.getQuizById(quizId);
    if (!quiz) return null;
    try {
      console.debug("[StartQuizUseCase] quiz entity fetched:", quiz);
      const extractedFormId = quiz.answerFormId;
      console.debug(
        "[StartQuizUseCase] formUrl:",
        quiz.formUrl,
        "extractedFormId:",
        extractedFormId
      );
      return {
        id: quiz.id,
        title: quiz.title,
        question: quiz.question,
        answerUrl: quiz.formUrl,
        answerFormId: extractedFormId,
        correctNo: quiz.correctNo ?? 1,
        timeLimit: quiz.timeLimit,
        options: quiz.options,
        bgm: quiz.bgm,
        settings: quiz.settings,
      };
    } catch (e) {
      console.warn("[StartQuizUseCase] debug logging error", e);
      return {
        id: quiz.id,
        title: quiz.title,
        question: quiz.question,
        answerUrl: quiz.formUrl,
        answerFormId: quiz.answerFormId,
        correctNo: quiz.correctNo ?? 1,
        timeLimit: quiz.timeLimit,
        options: quiz.options,
        bgm: quiz.bgm,
        settings: quiz.settings,
      };
    }
  }
}
