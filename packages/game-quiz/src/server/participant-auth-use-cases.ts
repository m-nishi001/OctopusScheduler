import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import { findMemberById } from "@octopus/member-directory/server-use-cases";
import type { MemberDirectoryUseCaseDeps } from "@octopus/member-directory/server-use-cases";
import type { ParticipantSession } from "./quiz-api-contract";

export interface ParticipantAuthDeps extends MemberDirectoryUseCaseDeps {
  storage: IKeyValueStorage;
  /** トークン生成関数。GAS本番では Utilities.getUuid() を注入する。 */
  generateToken: () => string;
}

const DEVICE_TOKEN_PREFIX = "quiz-game-device-token/";

/** 保存済みトークンから userId のみを解決する(回答送信など軽量な用途向け)。 */
export async function findUserIdByToken(storage: IKeyValueStorage, token: string): Promise<string | null> {
  return storage.get(`${DEVICE_TOKEN_PREFIX}${token}`);
}

/**
 * ユーザーIDでログインし、端末に保存する用のトークンを発行する。
 * 発行済みトークンは端末側の localStorage に保存され、以降は
 * resolveDeviceToken() で毎回のユーザーID入力を省略できる。
 */
export async function loginParticipant(
  deps: ParticipantAuthDeps,
  args: { userId: string }
): Promise<ParticipantSession> {
  const member = await findMemberById(deps, args.userId);
  if (!member) {
    throw new Error(`Member with userId "${args.userId}" not found`);
  }
  const token = deps.generateToken();
  await deps.storage.set(`${DEVICE_TOKEN_PREFIX}${token}`, member.id);
  return { token, userId: member.id, displayName: member.name };
}

/** 端末に保存済みのトークンから参加者情報を復元する。 */
export async function resolveDeviceToken(
  deps: ParticipantAuthDeps,
  args: { token: string }
): Promise<ParticipantSession> {
  const userId = await findUserIdByToken(deps.storage, args.token);
  if (!userId) {
    throw new Error("Invalid or expired device token");
  }
  const member = await findMemberById(deps, userId);
  if (!member) {
    throw new Error(`Member with userId "${userId}" no longer exists`);
  }
  return { token: args.token, userId: member.id, displayName: member.name };
}
