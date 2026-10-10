import { onScopeDispose } from "vue";
import { container } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import { QuizRoundGateway } from "../../model/quiz-round-gateway";
import type { QuizHostState } from "../../model/quiz-host-state";

export interface QuizHostHandlers {
  /** 管理端末の「次へ」。省略すると、表示画面の Enter キー押下と同じ扱い(画面ごとの既存の進行をそのまま使う)。 */
  advance?(): void;
  /** 回答受付を今すぐ締め切る(出題画面のみ)。 */
  closeAnswers?(): void;
}

export interface QuizHost {
  /** いまの画面の状態を公開する。 */
  publish(state: QuizHostState): void;
}

const NAMESPACE = "quiz";

/** 表示画面の Enter キー押下を再現する(各画面は document の keydown で進行を処理している)。 */
function pressEnter(): void {
  if (typeof document !== "undefined") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
}

/**
 * クイズの表示画面(ホスト端末)で使う。セッションのホストとして接続している場合だけ、
 * 管理端末からの quiz.* コマンドを受け付け、画面の状態を公開する。
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ(破棄時の後片付けを登録するため)。
 */
export function useQuizHost(handlers: QuizHostHandlers = {}): QuizHost {
  if (!container.isRegistered(HostAgent)) return { publish: () => undefined };
  const agent = container.resolve(HostAgent);
  const gateway = container.isRegistered(QuizRoundGateway) ? container.resolve(QuizRoundGateway) : new QuizRoundGateway();

  const off = agent.router.register(NAMESPACE, (command) => {
    if (command.type === "advance") (handlers.advance ?? pressEnter)();
    else if (command.type === "closeAnswers") handlers.closeAnswers?.();
  });
  onScopeDispose(() => {
    off();
    gateway.clear();
  });
  return { publish: (state) => gateway.publish(state) };
}
