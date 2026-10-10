import type { QuizSessionScope } from "../../server/quiz-api-contract";

/** 表示画面のルート名(プレビュー版は `-preview` が付く)。 */
export type QuizDisplayRoute = "quiz-qr" | "quiz-play" | "quiz-answer" | "quiz-result";

/**
 * クイズ1回の実施(本番 or デモ)を表す。受付状態・回答のscope、画面遷移先、
 * 参加URLの違いをここに閉じ込め、画面側は本番/デモの別を一切知らずに済ませる。
 */
export interface QuizSession {
  readonly scope: QuizSessionScope;
  /** 次の画面のルート名。 */
  routeName(base: QuizDisplayRoute): string;
  /** 参加者URLの末尾に付けるハッシュ内クエリ(参加者端末が同じセッションを選ぶため)。 */
  readonly joinUrlQuery: string;
}

export class LiveQuizSession implements QuizSession {
  readonly scope = "live" as const;
  readonly joinUrlQuery = "";

  routeName(base: QuizDisplayRoute): string {
    return base;
  }
}

export class DemoQuizSession implements QuizSession {
  readonly scope = "demo" as const;
  readonly joinUrlQuery = "?demo=1";

  routeName(base: QuizDisplayRoute): string {
    return `${base}-preview`;
  }
}
