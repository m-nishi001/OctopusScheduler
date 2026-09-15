import { injectable, inject } from "tsyringe";
import { StartQuizUseCase } from "./start-quiz-use-case";
import { GetQuizResultsUseCase } from "./get-quiz-results-use-case";
import { quizState } from "../../../services/quizState";
import type { QuizDto } from "../dtos/quiz-dto";
import type { QuizWithDataUrl } from "quiz-game-api";

export type PreparedQuizResults = {
  quiz: QuizDto | null;
  quizStartMs: number;
  results: { name: string; timeSeconds: number | null }[];
  error?: { message: string; code?: string };
  meta?: { usedPreview: boolean };
};

@injectable()
export class PrepareQuizResultsUseCase {
  constructor(
    @inject(StartQuizUseCase) private starter: StartQuizUseCase,
    @inject(GetQuizResultsUseCase) private getter: GetQuizResultsUseCase
  ) {}

  async execute(
    quizId: string,
    isPreview: boolean
  ): Promise<PreparedQuizResults | null> {
    try {
      const quiz = await this.starter.execute(quizId);
      if (!quiz) {
        return {
          quiz: null as any, // Note: quiz is null, but type requires it; handle in caller
          quizStartMs: Date.now(),
          results: [],
          error: { message: "Quiz not found", code: "QUIZ_NOT_FOUND" },
        };
      }

      const quizStartMs = quizState.getStartTime() ?? Date.now();
      if (!quizState.getStartTime()) quizState.setStartTime(quizStartMs);

      // Map our internal QuizDto to the external QuizWithDataUrl expected by GetQuizResultsUseCase
      const quizWithData: QuizWithDataUrl = {
        id: quiz.id,
        title: quiz.title,
        question: quiz.question,
        answerUrl: quiz.answerUrl,
        answerFormId: quiz.answerFormId,
        correctNo: quiz.correctNo,
        timeLimit: quiz.timeLimit,
        options: quiz.options,
        bgm: quiz.bgm,
        settings: quiz.settings,
      };

      // First, check for cached results produced by the play page while the DLG was shown.
      // Poll briefly (short window) to avoid a race where play page is just finishing.
      const POLL_INTERVAL_MS = 150;
      const MAX_WAIT_MS = 1200;
      let waited = 0;
      let cached: any[] | null = null;
      try {
        cached =
          typeof quizState.getResults === "function"
            ? quizState.getResults()
            : null;
      } catch (e) {
        cached = null;
      }

      while (
        (!cached || !Array.isArray(cached) || cached.length === 0) &&
        waited < MAX_WAIT_MS
      ) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        waited += POLL_INTERVAL_MS;
        try {
          cached =
            typeof quizState.getResults === "function"
              ? quizState.getResults()
              : null;
        } catch (e) {
          cached = null;
        }
      }

      if (cached && Array.isArray(cached) && cached.length > 0) {
        // Normalize cached items into { name, timeSeconds }
        const normalized = (cached as any[]).map((r: any, idx: number) => {
          // If already in expected shape
          if (
            r &&
            typeof r.name === "string" &&
            (r.timeSeconds === null || typeof r.timeSeconds === "number")
          ) {
            return { name: r.name, timeSeconds: r.timeSeconds };
          }
          // If it's a ResultDto-like { playerName, time } where time is ms
          if (r && (r.playerName || r.player) && typeof r.time === "number") {
            return {
              name: r.playerName ?? r.player ?? "匿名",
              timeSeconds: Number(r.time) / 1000,
            };
          }
          // If processed result with timeToAnswerMs or timestampMs
          if (
            r &&
            (typeof r.timeToAnswerMs === "number" ||
              typeof r.timestampMs === "number")
          ) {
            let tms: number | null = null;
            if (
              typeof r.timeToAnswerMs === "number" &&
              Number.isFinite(Number(r.timeToAnswerMs))
            ) {
              tms = Number(r.timeToAnswerMs);
            } else if (
              typeof r.timestampMs === "number" &&
              Number.isFinite(Number(r.timestampMs))
            ) {
              tms = Number(r.timestampMs) - Number(quizStartMs || Date.now());
            } else {
              tms = null;
            }
            return {
              name: r.playerName ?? r.name ?? "匿名",
              timeSeconds: Number.isFinite(tms as number)
                ? (tms as number) / 1000
                : null,
            };
          }
          // Last resort: map name heuristics
          return {
            name: r.playerName ?? r.name ?? r.displayName ?? "匿名",
            timeSeconds: null,
          };
        });

        // Clear cache after consumption to avoid reuse
        try {
          if (typeof quizState.clearResults === "function")
            quizState.clearResults();
        } catch (_) {}

        return {
          quiz,
          quizStartMs,
          results: normalized,
          meta: { usedPreview: isPreview },
        };
      }

      // No cache found in short window — fall back to full getter
      const results = await this.getter.execute(
        quizWithData,
        quizStartMs,
        isPreview
      );

      return {
        quiz,
        quizStartMs,
        results,
        meta: { usedPreview: isPreview },
      };
    } catch (error) {
      console.error("Error in PrepareQuizResultsUseCase", error);
      return {
        quiz: null as any,
        quizStartMs: Date.now(),
        results: [],
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          code: "EXECUTION_ERROR",
        },
      };
    }
  }
}
