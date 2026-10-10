import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { AcceptanceState, QuizSessionScope } from "./quiz-api-contract";
import { sessionKey } from "./session-key";

const ACCEPTANCE_KEY_PREFIX = "quiz-game-acceptance";

export function acceptanceKey(quizId: string, scope: QuizSessionScope): string {
  return sessionKey(ACCEPTANCE_KEY_PREFIX, quizId, scope);
}

export async function readAcceptanceState(
  storage: IKeyValueStorage,
  quizId: string,
  scope: QuizSessionScope
): Promise<AcceptanceState | null> {
  const raw = await storage.get(acceptanceKey(quizId, scope));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AcceptanceState;
  } catch {
    return null;
  }
}
