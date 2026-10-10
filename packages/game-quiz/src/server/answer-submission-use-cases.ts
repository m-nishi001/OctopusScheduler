import { DomainError } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import { findMemberById } from "@octopus/accounts/server-use-cases";
import type { AccountsUseCaseDeps } from "@octopus/accounts/server-use-cases";
import type { QuizSessionScope, SubmittedAnswer } from "./quiz-api-contract";
import { sessionKey } from "./session-key";
import { readAcceptanceState } from "./acceptance-state";
import { findUserIdByToken } from "./participant-auth-use-cases";

export interface AnswerSubmissionDeps extends AccountsUseCaseDeps {
  storage: IKeyValueStorage;
  /** サーバー側の受信時刻(ms)。GAS本番では Date.now() を注入する。 */
  now: () => number;
}

function answersKey(quizId: string, scope: QuizSessionScope): string {
  return sessionKey("quiz-game-answers", quizId, scope);
}

async function readAnswers(
  storage: IKeyValueStorage,
  quizId: string,
  scope: QuizSessionScope
): Promise<SubmittedAnswer[]> {
  const raw = await storage.get(answersKey(quizId, scope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAnswers(
  storage: IKeyValueStorage,
  quizId: string,
  scope: QuizSessionScope,
  answers: SubmittedAnswer[]
): Promise<void> {
  await storage.set(answersKey(quizId, scope), JSON.stringify(answers));
}

/**
 * 指定クイズ・指定scopeの回答をすべて消す。回答受付の開始(=新しいラウンド)時に呼び、
 * 前回ラウンドの回答が今回の回答として残らないようにする。
 */
export async function clearAnswers(
  storage: IKeyValueStorage,
  quizId: string,
  scope: QuizSessionScope
): Promise<void> {
  await writeAnswers(storage, quizId, scope, []);
}

/**
 * 参加者の回答を記録する。タイムスタンプはクライアントの時計を信用せず、
 * サーバー側の受信時刻を使う。同一クイズ・同一参加者からの再送信は回答の変更として
 * 扱い、受付中は最後の回答を正とする(回答受付を開始するたびに clearAnswers で消える)。
 * (呼び出し側での同時書き込みの
 * 競合はGASの LockService 相当のロックで守る想定 — endpoints.ts 側の責務)。
 */
export async function submitAnswer(
  deps: AnswerSubmissionDeps,
  args: { quizId: string; scope: QuizSessionScope; token: string; optionNo: number }
): Promise<SubmittedAnswer> {
  const acceptance = await readAcceptanceState(deps.storage, args.quizId, args.scope);
  if (!acceptance?.isAccepting) {
    throw new DomainError("Answers are not being accepted");
  }
  const userId = await findUserIdByToken(deps.storage, args.token);
  if (!userId) {
    throw new DomainError("Invalid or expired device token");
  }
  const member = await findMemberById(deps, userId);
  if (!member) {
    throw new DomainError(`Member with userId "${userId}" no longer exists`);
  }

  const answers = await readAnswers(deps.storage, args.quizId, args.scope);
  // 受付中は何度でも変更できる。最後の回答を正とし、タイムスタンプも最後の送信時刻に更新する。
  const others = answers.filter((a) => a.userId !== userId);

  const answer: SubmittedAnswer = {
    userId,
    displayName: member.name,
    optionNo: args.optionNo,
    serverTimestampMs: deps.now(),
  };
  await writeAnswers(deps.storage, args.quizId, args.scope, [...others, answer]);
  return answer;
}

export async function getAnswers(
  deps: AnswerSubmissionDeps,
  args: { quizId: string; scope: QuizSessionScope }
): Promise<SubmittedAnswer[]> {
  return readAnswers(deps.storage, args.quizId, args.scope);
}
