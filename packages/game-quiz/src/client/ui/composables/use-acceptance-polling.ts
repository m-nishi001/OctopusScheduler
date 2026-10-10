import { ref } from "vue";
import { container } from "tsyringe";
import { usePolling } from "@octopus/composables";
import { GetParticipantStateUseCase } from "../../control/use-cases/get-participant-state-use-case";
import type { AcceptanceState, QuizSessionScope } from "../../../server/quiz-api-contract";

const POLL_INTERVAL_MS = 1000;

export interface UseAcceptancePollingDeps {
  useCase: Pick<GetParticipantStateUseCase, "execute">;
}

/**
 * 参加者端末が回答受付状態をポーリングし続けるcomposable。受付状態に加えて自分の回答
 * (myAnswerNo)も受け取るため、リロード後も選択状態をサーバーから復元できる。
 * 参加URLのトークンが無効になった(新しいセッションのQRに切り替わった)場合は
 * isLinkExpired を立ててポーリングを止める。
 * 依存はテストで差し替えられるよう引数として受け取れるようにしている
 * (省略時は実際のDIコンテナを使う)。
 */
export function useAcceptancePolling(
  quizId: string,
  scope: QuizSessionScope,
  joinToken: string,
  getDeviceToken: () => string | undefined,
  deps?: Partial<UseAcceptancePollingDeps>
) {
  const state = ref<AcceptanceState | null>(null);
  const myAnswerNo = ref<number | null>(null);
  const isLinkExpired = ref(false);
  const useCase = deps?.useCase ?? container.resolve(GetParticipantStateUseCase);

  const { start, stop, isActive } = usePolling(
    async () => {
      try {
        const result = await useCase.execute(quizId, scope, joinToken, getDeviceToken());
        state.value = result.acceptance;
        myAnswerNo.value = result.myAnswerNo;
      } catch (e) {
        if (e instanceof Error && e.message.includes("Join link is no longer valid")) {
          isLinkExpired.value = true;
          stop();
        }
        // それ以外の一時的なポーリング失敗は無視し、次回のポーリングに委ねる
      }
    },
    POLL_INTERVAL_MS,
    { immediate: true }
  );

  return { state, myAnswerNo, isLinkExpired, start, stop, isActive };
}
