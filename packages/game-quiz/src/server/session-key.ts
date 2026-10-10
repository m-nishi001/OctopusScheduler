import { DomainError } from "@octopus/infrastructures/interfaces";
import type { QuizSessionScope } from "./quiz-api-contract";

/**
 * 受付状態・回答のKVキーを組み立てる唯一の場所。本番とデモの分離はscopeの値だけで行う。
 * scopeは公開エンドポイントの引数として届くため、想定外の値でキーが作られないようここで弾く。
 */
export function sessionKey(prefix: string, quizId: string, scope: QuizSessionScope): string {
  if (scope !== "live" && scope !== "demo") {
    throw new DomainError(`Invalid quiz session scope: ${String(scope)}`);
  }
  return `${prefix}/${quizId}:${scope}`;
}
