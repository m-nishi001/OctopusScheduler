/** 運営・参加者からのコマンド発行と、ホストによる状態の公開。 */
import {
  COMMAND_KEY_PATTERN,
  MAX_CLIENT_INPUT_MEMBERS,
  MAX_CLIENT_INPUT_MEMBER_ID_LENGTH,
  MAX_COMMAND_PAYLOAD_BYTES,
  MAX_STATE_BYTES,
  clientInputAllows,
  commandKey,
} from "../../shared/session-types";
import type { ClientInput, Command, RoomState } from "../../shared/session-types";
import type { IssueCommandArgs, IssueCommandResult, PublishStateArgs, PublishStateResult } from "../../shared/protocol";
import { EMPTY_HEAD, authenticate, jsonBytes } from "./engine-core";
import type { EngineDeps } from "./engine-core";
import { hubError } from "./hub-error";

const MAX_RECENT_REQUESTS = 16;
const MAX_REQUEST_ID_LENGTH = 64;

/** 管理(または許可された参加者入力)からコマンドを発行する。 */
export async function issueCommand(deps: EngineDeps, args: IssueCommandArgs): Promise<IssueCommandResult> {
  const { meta, device } = await authenticate(deps, args);
  if (device.role === "host") {
    throw hubError("FORBIDDEN", "ホスト端末はコマンドを発行できません");
  }

  const key = commandKey(args.game, args.type);
  if (!COMMAND_KEY_PATTERN.test(key)) {
    throw hubError("INVALID_ARGUMENT", `コマンド種別が不正です: ${key}`);
  }
  if (!args.requestId || args.requestId.length > MAX_REQUEST_ID_LENGTH) {
    throw hubError("INVALID_ARGUMENT", "requestId が不正です");
  }
  if (jsonBytes(args.payload ?? null) > MAX_COMMAND_PAYLOAD_BYTES) {
    throw hubError("PAYLOAD_TOO_LARGE", "コマンドのペイロードが大きすぎます");
  }

  const head = (await deps.repo.getHead()) ?? EMPTY_HEAD(meta);

  if (device.role === "client") {
    // 参加者は、ホストが「いま受け付ける」と公開したコマンドだけ、宛先が決まっていればその本人だけ送れる。
    const state = head.stateVersion > 0 ? await deps.repo.getState() : null;
    if (!state || !clientInputAllows(state.clientInput, key, device)) {
      throw hubError("FORBIDDEN", "いまはこの操作を受け付けていません");
    }
  }

  const dup = head.recent.find((r) => r.requestId === args.requestId);
  if (dup) return { seq: dup.seq, duplicate: true };

  const now = deps.now();
  const seq = head.seq + 1;
  const command: Command = {
    seq,
    requestId: args.requestId,
    game: args.game,
    type: args.type,
    payload: args.payload ?? null,
    issuedBy: device.deviceId,
    issuerRole: device.role,
    atMs: now,
  };
  // 先にコマンド本体、後で head。head が指す seq の実体が必ず存在する順にする。
  await deps.repo.putCommand(command);
  await deps.repo.putHead({
    ...head,
    seq,
    updatedAtMs: now,
    recent: [...head.recent, { requestId: args.requestId, seq }].slice(-MAX_RECENT_REQUESTS),
  });
  return { seq, duplicate: false };
}

/** 受け付ける操作の形(key が "game.type"、宛先があれば短い文字列の配列)。 */
function isValidClientInput(inputs: unknown): inputs is ClientInput[] {
  if (!Array.isArray(inputs)) return false;
  const keys = new Set<string>();
  for (const input of inputs) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
    const { key, memberIds } = input as Record<string, unknown>;
    if (typeof key !== "string" || !COMMAND_KEY_PATTERN.test(key) || keys.has(key)) return false;
    keys.add(key);
    if (memberIds === undefined) continue;
    if (!Array.isArray(memberIds) || memberIds.length === 0 || memberIds.length > MAX_CLIENT_INPUT_MEMBERS) return false;
    if (!memberIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_CLIENT_INPUT_MEMBER_ID_LENGTH)) return false;
  }
  return true;
}

/** ホストが現在の状態(RoomState)を公開する。 */
export async function publishState(deps: EngineDeps, args: PublishStateArgs): Promise<PublishStateResult> {
  const { meta, device } = await authenticate(deps, args);
  if (device.role !== "host" || meta.hostDeviceId !== device.deviceId) {
    throw hubError("NOT_HOST", "現在のホスト端末だけが状態を公開できます");
  }
  const clientInput = args.clientInput ?? [];
  if (!isValidClientInput(clientInput)) {
    throw hubError("INVALID_ARGUMENT", "clientInput の形式が不正です");
  }
  if (typeof args.data !== "object" || args.data === null || Array.isArray(args.data)) {
    throw hubError("INVALID_ARGUMENT", "data はオブジェクトで指定してください");
  }
  if (jsonBytes({ data: args.data, clientInput }) > MAX_STATE_BYTES) {
    throw hubError("PAYLOAD_TOO_LARGE", "公開する状態が大きすぎます");
  }

  const head = (await deps.repo.getHead()) ?? EMPTY_HEAD(meta);
  const now = deps.now();
  const state: RoomState = {
    version: head.stateVersion + 1,
    data: args.data,
    clientInput,
    updatedAtMs: now,
  };
  await deps.repo.putState(state);
  await deps.repo.putHead({ ...head, stateVersion: state.version, updatedAtMs: now });
  return { version: state.version };
}
