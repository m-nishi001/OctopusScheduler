import { onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { container } from "tsyringe";
import { StartQuizUseCase } from "../../control/use-cases/start-quiz-use-case";
import { buildQuizHostState } from "../../model/quiz-host-state";
import type { QuizHostPage } from "../../model/quiz-host-state";
import type { QuizDisplayRoute } from "../../model/quiz-session";
import { useQuizHost } from "./use-quiz-host";
import { useQuizSession } from "./use-quiz-session";

export interface QuizStepOptions {
  /** この画面が公開する状態のページ名。 */
  page: QuizHostPage;
  /** Enter / 管理端末の「次へ」で進む先のルート名。 */
  next: QuizDisplayRoute;
  /** ホストとして接続しているときだけ、画面を表示した直後に呼ぶ。 */
  onShown?: () => void | Promise<void>;
  /** 次へ進む直前に呼ぶ(終わるまで待ってから遷移する)。 */
  beforeNext?: () => void | Promise<void>;
}

/**
 * クイズの表示画面(イントロ/エントリーなど、押して進むだけの画面)に共通する動き。
 * 画面の状態の公開、Enter キーと管理端末の「次へ」での遷移、本番/デモの別をまとめる。
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ。
 */
export function useQuizStep(options: QuizStepOptions): { quizId: string } {
  const router = useRouter();
  const route = useRoute();
  const quizId = route.params.id as string;
  const session = useQuizSession();

  let leaving = false;
  const goNext = async () => {
    if (leaving) return;
    leaving = true;
    try {
      await options.beforeNext?.();
    } finally {
      await router.push({ name: session.routeName(options.next), params: { id: quizId } });
    }
  };
  // セッションのホストなら、管理端末の「次へ」でも進める。
  const host = useQuizHost({ advance: () => void goNext() });

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") void goNext();
  };

  onMounted(async () => {
    document.addEventListener("keydown", handleKeydown);
    try {
      const quiz = await container.resolve(StartQuizUseCase).execute(quizId);
      host.publish(buildQuizHostState({ page: options.page, quizId, title: quiz?.title }));
    } catch {
      host.publish(buildQuizHostState({ page: options.page, quizId }));
    }
    if (host.lobbyPath() !== null) await options.onShown?.();
  });
  onUnmounted(() => document.removeEventListener("keydown", handleKeydown));

  return { quizId };
}
