import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { SubmittedAnswer } from "./quiz-api-contract";
import { findMemberByUserId } from "./member-use-cases";
import { findUserIdByToken } from "./participant-auth-use-cases";

export interface AnswerSubmissionDeps {
  storage: IKeyValueStorage;
  /** サーバー側の受信時刻(ms)。GAS本番では Date.now() を注入する。 */
  now: () => number;
}

function answersKey(quizId: string): string {
  return `quiz-game-answers/${quizId}`;
}

async function readAnswers(storage: IKeyValueStorage, quizId: string): Promise<SubmittedAnswer[]> {
  const raw = await storage.get(answersKey(quizId));
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
  answers: SubmittedAnswer[]
): Promise<void> {
  await storage.set(answersKey(quizId), JSON.stringify(answers));
}

/**
 * 参加者の回答を記録する。タイムスタンプはクライアントの時計を信用せず、
 * サーバー側の受信時刻を使う。同一クイズ・同一参加者からの2回目以降の
 * 送信は無視し、最初に届いた回答を正とする(呼び出し側での同時書き込みの
 * 競合はGASの LockService 相当のロックで守る想定 — endpoints.ts 側の責務)。
 */
export async function submitAnswer(
  deps: AnswerSubmissionDeps,
  args: { quizId: string; token: string; optionNo: number }
): Promise<SubmittedAnswer> {
  const userId = await findUserIdByToken(deps.storage, args.token);
  if (!userId) {
    throw new Error("Invalid or expired device token");
  }
  const member = await findMemberByUserId(deps, userId);
  if (!member) {
    throw new Error(`Member with userId "${userId}" no longer exists`);
  }

  const answers = await readAnswers(deps.storage, args.quizId);
  const existing = answers.find((a) => a.userId === userId);
  if (existing) {
    return existing;
  }

  const answer: SubmittedAnswer = {
    userId,
    displayName: member.displayName,
    optionNo: args.optionNo,
    serverTimestampMs: deps.now(),
  };
  await writeAnswers(deps.storage, args.quizId, [...answers, answer]);
  return answer;
}

export async function getAnswers(
  deps: AnswerSubmissionDeps,
  args: { quizId: string }
): Promise<SubmittedAnswer[]> {
  return readAnswers(deps.storage, args.quizId);
}
