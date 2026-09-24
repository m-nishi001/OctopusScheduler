import { ref } from "vue";
import { container } from "tsyringe";
import { usePolling } from "@octopus/composables";
import { GetAcceptanceStateUseCase } from "../../control/use-cases/get-acceptance-state-use-case";
import type { AcceptanceState } from "../../../server/quiz-api-contract";

const POLL_INTERVAL_MS = 1000;

export interface UseAcceptancePollingDeps {
  useCase: Pick<GetAcceptanceStateUseCase, "execute">;
}

/**
 * クイズの回答受付状態をポーリングし続けるcomposable。参加者端末側で使う。
 * 依存はテストで差し替えられるよう引数として受け取れるようにしている
 * (省略時は実際のDIコンテナを使う)。
 */
export function useAcceptancePolling(quizId: string, deps?: Partial<UseAcceptancePollingDeps>) {
  const state = ref<AcceptanceState | null>(null);
  const useCase = deps?.useCase ?? container.resolve(GetAcceptanceStateUseCase);

  const { start, stop, isActive } = usePolling(
    async () => {
      try {
        state.value = await useCase.execute(quizId);
      } catch {
        // 一時的なポーリング失敗は無視し、次回のポーリングに委ねる
      }
    },
    POLL_INTERVAL_MS,
    { immediate: true }
  );

  return { state, start, stop, isActive };
}
