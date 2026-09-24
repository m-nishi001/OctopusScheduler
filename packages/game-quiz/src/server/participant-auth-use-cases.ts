import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { ParticipantSession } from "./quiz-api-contract";
import { findMemberByUserId } from "./member-use-cases";

export interface ParticipantAuthDeps {
  storage: IKeyValueStorage;
  /** トークン生成関数。GAS本番では Utilities.getUuid() を注入する。 */
  generateToken: () => string;
}

const DEVICE_TOKEN_PREFIX = "quiz-game-device-token/";

/** 保存済みトークンから userId のみを解決する(回答送信など軽量な用途向け)。 */
export function findUserIdByToken(storage: IKeyValueStorage, token: string): string | null {
  return storage.get(`${DEVICE_TOKEN_PREFIX}${token}`);
}

/**
 * ユーザーIDでログインし、端末に保存する用のトークンを発行する。
 * 発行済みトークンは端末側の localStorage に保存され、以降は
 * resolveDeviceToken() で毎回のユーザーID入力を省略できる。
 */
export function loginParticipant(
  deps: ParticipantAuthDeps,
  args: { userId: string }
): ParticipantSession {
  const member = findMemberByUserId(deps, args.userId);
  if (!member) {
    throw new Error(`Member with userId "${args.userId}" not found`);
  }
  const token = deps.generateToken();
  deps.storage.set(`${DEVICE_TOKEN_PREFIX}${token}`, member.userId);
  return { token, userId: member.userId, displayName: member.displayName };
}

/** 端末に保存済みのトークンから参加者情報を復元する。 */
export function resolveDeviceToken(
  deps: ParticipantAuthDeps,
  args: { token: string }
): ParticipantSession {
  const userId = findUserIdByToken(deps.storage, args.token);
  if (!userId) {
    throw new Error("Invalid or expired device token");
  }
  const member = findMemberByUserId(deps, userId);
  if (!member) {
    throw new Error(`Member with userId "${userId}" no longer exists`);
  }
  return { token: args.token, userId: member.userId, displayName: member.displayName };
}
