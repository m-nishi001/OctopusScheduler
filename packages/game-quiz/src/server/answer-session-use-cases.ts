import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { AcceptanceState } from "./quiz-api-contract";

export interface AnswerSessionDeps {
  storage: IKeyValueStorage;
  /** 現在時刻(ms)を返す関数。GAS本番では Date.now() を注入する。 */
  now: () => number;
}

const ACCEPTANCE_KEY_PREFIX = "quiz-game-acceptance/";

function acceptanceKey(quizId: string): string {
  return `${ACCEPTANCE_KEY_PREFIX}${quizId}`;
}

async function readState(storage: IKeyValueStorage, quizId: string): Promise<AcceptanceState | null> {
  const raw = await storage.get(acceptanceKey(quizId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AcceptanceState;
  } catch {
    return null;
  }
}

/**
 * 回答受付を開始する。出題前(QR表示中など)に回答できてしまうバグの修正の要:
 * ここで記録される acceptStartedAtMs が、集計時の下限フィルタの基準になる。
 */
export async function startAcceptingAnswers(
  deps: AnswerSessionDeps,
  args: { quizId: string; options: AcceptanceState["options"] }
): Promise<AcceptanceState> {
  const state: AcceptanceState = {
    quizId: args.quizId,
    isAccepting: true,
    acceptStartedAtMs: deps.now(),
    options: args.options,
  };
  await deps.storage.set(acceptanceKey(args.quizId), JSON.stringify(state));
  return state;
}

/**
 * 回答受付を終了する。タイマー終了時の自動呼び出しと、管理者の手動緊急停止の
 * 両方から呼ばれる想定。acceptStartedAtMs は集計のために保持したまま残す。
 */
export async function stopAcceptingAnswers(
  deps: AnswerSessionDeps,
  args: { quizId: string }
): Promise<AcceptanceState> {
  const current = await readState(deps.storage, args.quizId);
  const state: AcceptanceState = {
    quizId: args.quizId,
    isAccepting: false,
    acceptStartedAtMs: current?.acceptStartedAtMs ?? null,
    options: current?.options ?? [],
  };
  await deps.storage.set(acceptanceKey(args.quizId), JSON.stringify(state));
  return state;
}

/** 参加者端末からのポーリング用の軽量参照。 */
export async function getAcceptanceState(
  deps: AnswerSessionDeps,
  args: { quizId: string }
): Promise<AcceptanceState> {
  return (
    (await readState(deps.storage, args.quizId)) ?? {
      quizId: args.quizId,
      isAccepting: false,
      acceptStartedAtMs: null,
      options: [],
    }
  );
}
