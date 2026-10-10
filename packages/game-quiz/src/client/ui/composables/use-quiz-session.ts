import { useRoute } from "vue-router";
import { DemoQuizSession, LiveQuizSession, type QuizSession } from "../../model/quiz-session";

/**
 * ルートから本番/デモを判定する唯一の場所。
 * 管理者の表示画面は `-preview` ルート、参加者の端末はQRのURLに付く `?demo=1` で判定する。
 */
export function resolveQuizSession(route: { name?: unknown; query?: Record<string, unknown> }): QuizSession {
  const isDemo = String(route.name ?? "").endsWith("-preview") || route.query?.demo === "1";
  return isDemo ? new DemoQuizSession() : new LiveQuizSession();
}

export function useQuizSession(): QuizSession {
  return resolveQuizSession(useRoute());
}
