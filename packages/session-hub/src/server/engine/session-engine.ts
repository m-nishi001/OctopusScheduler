/**
 * セッション1件に対する操作(参加・購読・コマンド発行・状態公開)の中核ロジック。
 *
 * 永続化は `SessionRepo`、在席は `PresenceStore` に委ね、時刻・ID生成は外から注入するので
 * 副作用を持たず、GAS/R2 のKV実装でも Durable Object でも同じコードを使える。
 * 排他(同一セッションへの同時書き込みの直列化)は呼び出し側の責務
 * (GAS/R2: ILock、Durable Object: 単一スレッド実行)。
 */
import {
  ADMIN_ALIVE_MS,
  CLIENT_ALIVE_MS,
  COMMAND_KEY_PATTERN,
  DEVICE_ID_PATTERN,
  COMMAND_RING_SIZE,
  HOST_STALE_MS,
  MAX_COMMAND_PAYLOAD_BYTES,
  MAX_STATE_BYTES,
  commandKey,
} from "../../shared/session-types";
import type {
  Command,
  Device,
  PresenceEntry,
  DeviceRole,
  PresenceView,
  RoomState,
  SessionMeta,
} from "../../shared/session-types";
import type {
  DeviceCredentials,
  IssueCommandArgs,
  IssueCommandResult,
  JoinClientArgs,
  JoinOperatorArgs,
  JoinResult,
  PollArgs,
  PollResult,
  PublishStateArgs,
  PublishStateResult,
} from "../../shared/protocol";
import { computeNextPollMs } from "../../shared/poll-interval";
import { hubError } from "./hub-error";
import type { PresenceStore, SessionRepo, StoredHead } from "./session-repo";

export interface EngineDeps {
  repo: SessionRepo;
  presence: PresenceStore;
  now: () => number;
  newId: () => string;
  newToken: () => string;
}

const MAX_RECENT_REQUESTS = 16;
const MAX_LABEL_LENGTH = 60;
const MAX_REQUEST_ID_LENGTH = 64;
const EMPTY_HEAD = (meta: SessionMeta): StoredHead => ({
  seq: 0,
  stateVersion: 0,
  updatedAtMs: meta.createdAtMs,
  recent: [],
});

/** タイミング差でトークンが推測されにくいよう全桁を比較する。 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function jsonBytes(value: unknown): number {
  const s = JSON.stringify(value) ?? "";
  // UTF-8 のバイト数(日本語は3バイト)。TextEncoder が無い環境でも動くよう手計算する。
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function cleanLabel(label: string | undefined, fallback: string): string {
  const trimmed = (label ?? "").trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed || fallback;
}

async function loadMeta(repo: SessionRepo, now: number): Promise<SessionMeta> {
  const meta = await repo.getMeta();
  if (!meta) throw hubError("SESSION_NOT_FOUND", "セッションが見つかりません");
  if (meta.status === "closed" || meta.expiresAtMs <= now) {
    throw hubError("SESSION_CLOSED", "セッションは終了しています");
  }
  return meta;
}

/** 端末の認証。セッションが有効で、deviceId と token が一致するときだけ端末を返す。 */
export async function authenticate(
  deps: Pick<EngineDeps, "repo" | "now">,
  creds: DeviceCredentials
): Promise<{ meta: SessionMeta; device: Device }> {
  const meta = await loadMeta(deps.repo, deps.now());
  const device = creds.deviceId ? await deps.repo.getDevice(creds.deviceId) : null;
  if (!device || !creds.token || !safeEqual(device.token, creds.token)) {
    throw hubError("DEVICE_UNAUTHORIZED", "端末を認証できません。入室し直してください");
  }
  return { meta, device };
}

function toJoinResult(meta: SessionMeta, device: Device, head: StoredHead | null): JoinResult {
  return {
    session: meta,
    deviceId: device.deviceId,
    token: device.token,
    role: device.role,
    head: { seq: head?.seq ?? 0, stateVersion: head?.stateVersion ?? 0 },
  };
}

function isAlive(entry: PresenceEntry | undefined, now: number, thresholdMs: number): boolean {
  return !!entry && now - entry.seenAtMs <= thresholdMs;
}

/** ログイン済みの運営者(ホスト/管理)として入室する。呼び出し側が管理者認証を済ませていること。 */
export async function joinOperator(
  deps: EngineDeps,
  args: JoinOperatorArgs,
  memberId: string
): Promise<JoinResult> {
  const now = deps.now();
  const meta = await loadMeta(deps.repo, now);
  if (args.role !== "host" && args.role !== "admin") {
    throw hubError("INVALID_ARGUMENT", "role は host か admin を指定してください");
  }

  // 同じ端末としての復帰(リロード)。端末IDはクライアントが採番して送るため、入室の応答が
  // 失われて再送されたときも、同じIDなら前回作った端末をそのまま返す(冪等)。
  // IDが他人/他の役割の端末と衝突した場合は流用せず、サーバが新しいIDを採番する。
  const requestedId = args.deviceId && DEVICE_ID_PATTERN.test(args.deviceId) ? args.deviceId : undefined;
  let device: Device | null = null;
  let newDeviceId = deps.newId();
  if (requestedId) {
    const existing = await deps.repo.getDevice(requestedId);
    if (!existing) newDeviceId = requestedId;
    else if (existing.role === args.role && existing.memberId === memberId) device = existing;
  }

  if (args.role === "host" && meta.hostDeviceId && meta.hostDeviceId !== device?.deviceId) {
    const presence = await deps.presence.list();
    const current = presence.find((p) => p.deviceId === meta.hostDeviceId);
    if (isAlive(current, now, HOST_STALE_MS) && !args.takeover) {
      throw hubError(
        "HOST_ALREADY_CONNECTED",
        `別のホスト端末(${current?.label ?? "不明"})が接続中です。引き継ぐ場合は確認してください`
      );
    }
  }

  const label = cleanLabel(args.label, args.role === "host" ? "ホスト" : "管理");
  if (!device) {
    device = {
      deviceId: newDeviceId,
      sessionId: meta.id,
      role: args.role,
      memberId,
      label,
      token: deps.newToken(),
      joinedAtMs: now,
    };
    await deps.repo.putDevice(device);
  } else if (device.label !== label) {
    device = { ...device, label };
    await deps.repo.putDevice(device);
  }

  if (args.role === "host" && (meta.hostDeviceId !== device.deviceId || meta.status === "lobby")) {
    await deps.repo.putMeta({ ...meta, hostDeviceId: device.deviceId, status: "live" });
  }
  await deps.presence.touch({
    deviceId: device.deviceId,
    role: device.role,
    label: device.label,
    seenAtMs: now,
    ackSeq: 0,
  });
  return toJoinResult(
    { ...meta, hostDeviceId: args.role === "host" ? device.deviceId : meta.hostDeviceId, status: args.role === "host" ? "live" : meta.status },
    device,
    await deps.repo.getHead()
  );
}

/** 参加者として入室する(参加コード解決は呼び出し側)。 */
export async function joinClient(deps: EngineDeps, args: JoinClientArgs): Promise<JoinResult> {
  const now = deps.now();
  const meta = await loadMeta(deps.repo, now);

  if (args.deviceId && args.token) {
    const existing = await deps.repo.getDevice(args.deviceId);
    if (existing && existing.role === "client" && safeEqual(existing.token, args.token)) {
      await deps.presence.touch({
        deviceId: existing.deviceId,
        role: "client",
        label: existing.label,
        seenAtMs: now,
        ackSeq: 0,
      });
      return toJoinResult(meta, existing, await deps.repo.getHead());
    }
  }

  const device: Device = {
    deviceId: deps.newId(),
    sessionId: meta.id,
    role: "client",
    memberId: args.memberId ?? null,
    label: cleanLabel(args.label, "参加者"),
    token: deps.newToken(),
    joinedAtMs: now,
  };
  await deps.repo.putDevice(device);
  await deps.presence.touch({
    deviceId: device.deviceId,
    role: "client",
    label: device.label,
    seenAtMs: now,
    ackSeq: 0,
  });
  return toJoinResult(meta, device, await deps.repo.getHead());
}

export function buildPresenceView(
  entries: PresenceEntry[],
  hostDeviceId: string | null,
  now: number
): PresenceView {
  const host = entries.find((e) => e.deviceId === hostDeviceId) ?? null;
  return {
    host,
    admins: entries.filter((e) => e.role === "admin" && isAlive(e, now, ADMIN_ALIVE_MS)),
    clientCount: entries.filter((e) => e.role === "client" && isAlive(e, now, CLIENT_ALIVE_MS)).length,
  };
}

/** 更新1件(PollResult)を作るのに必要な読み取り。ポーリングと WebSocket の push で共通に使う。 */
export interface UpdateSource {
  meta: SessionMeta;
  head: StoredHead;
  presence: PresenceView;
  now: number;
  /** 現在の RoomState(未公開は null)。同じ push の中で何度呼ばれても1回の読み取りで済むようメモ化して渡す。 */
  getState: () => Promise<RoomState | null>;
  getCommand: (seq: number) => Promise<Command | null>;
}

/**
 * ある端末(role, 手元の seq / state version)に送る更新を組み立てる。
 * 参加者には運営向けのコマンドを渡さない(進行の中身を露出させない)。
 */
export async function buildUpdate(
  src: UpdateSource,
  role: DeviceRole,
  sinceSeq: number,
  stateVersion: number
): Promise<PollResult> {
  const { meta, head } = src;
  let commands: Command[] = [];
  let resync = false;
  if (role !== "client") {
    const since = Math.max(0, sinceSeq);
    if (since > head.seq) {
      // 手元の方が先に進んでいる(セッションが作り直された等)。取り直させる。
      resync = true;
    } else if (head.seq - since > COMMAND_RING_SIZE) {
      resync = true;
    } else {
      for (let seq = since + 1; seq <= head.seq; seq++) {
        const cmd = await src.getCommand(seq);
        if (!cmd || cmd.seq !== seq) {
          resync = true;
          commands = [];
          break;
        }
        commands.push(cmd);
      }
    }
  }

  const needState = head.stateVersion !== stateVersion || resync;
  const state = needState && head.stateVersion > 0 ? await src.getState() : null;

  return {
    session: { id: meta.id, code: meta.code, name: meta.name, mode: meta.mode, status: meta.status, hostDeviceId: meta.hostDeviceId },
    serverTimeMs: src.now,
    head: { seq: head.seq, stateVersion: head.stateVersion },
    commands,
    resync,
    state,
    presence: src.presence,
    nextPollMs: computeNextPollMs(role, src.now - head.updatedAtMs),
  };
}

/** 差分の取得(コマンド・状態・在席)と、次回までの間隔の指示。 */
export async function poll(deps: EngineDeps, args: PollArgs): Promise<PollResult> {
  const { meta, device } = await authenticate(deps, args);
  const now = deps.now();
  const head = (await deps.repo.getHead()) ?? EMPTY_HEAD(meta);

  const entries = await deps.presence.touch({
    deviceId: device.deviceId,
    role: device.role,
    label: device.label,
    seenAtMs: now,
    ackSeq: device.role === "host" ? Math.max(0, args.ackSeq ?? 0) : 0,
  });

  return buildUpdate(
    {
      meta,
      head,
      presence: buildPresenceView(entries, meta.hostDeviceId, now),
      now,
      getState: () => deps.repo.getState(),
      getCommand: (seq) => deps.repo.getCommand(seq),
    },
    device.role,
    args.sinceSeq,
    args.stateVersion
  );
}

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
    // 参加者は、ホストが「いま受け付ける」と公開したコマンドだけ送れる。
    const state = head.stateVersion > 0 ? await deps.repo.getState() : null;
    if (!state?.clientInput.includes(key)) {
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

/** ホストが現在の状態(RoomState)を公開する。 */
export async function publishState(deps: EngineDeps, args: PublishStateArgs): Promise<PublishStateResult> {
  const { meta, device } = await authenticate(deps, args);
  if (device.role !== "host" || meta.hostDeviceId !== device.deviceId) {
    throw hubError("NOT_HOST", "現在のホスト端末だけが状態を公開できます");
  }
  const clientInput = args.clientInput ?? [];
  if (!clientInput.every((k) => COMMAND_KEY_PATTERN.test(k))) {
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
