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
  MAX_ROUND_ANSWERS_KV,
  MAX_ROUND_DURATION_MS,
  MAX_ROUND_OPTIONS,
  MAX_ROUND_OPTION_TEXT,
  MIN_ROUND_DURATION_MS,
  ROUND_KEY_PATTERN,
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
  CloseRoundArgs,
  DeviceCredentials,
  GetAnswersArgs,
  GetAnswersResult,
  OpenRoundArgs,
  OpenRoundResult,
  RoundAnswer,
  RoundSummary,
  SubmitAnswerArgs,
  SubmitAnswerResult,
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
import type { PresenceStore, SessionRepo, StoredHead, StoredRound } from "./session-repo";

export interface EngineDeps {
  /** 回答ラウンドで受け付けられる回答数の上限(KV は少なく、Durable Object は多い)。 */
  maxAnswers?: number;
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
  /** 回答ラウンドの要約。運営端末(ホスト/管理)の更新にだけ使う。 */
  getRound?: () => Promise<RoundSummary | null>;
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
    round: role !== "client" && head.hasRound && src.getRound ? await src.getRound() : null,
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
      getRound: async () => toRoundSummary(await deps.repo.getRound(), now),
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

// ---- 回答ラウンド ----

/** 受付中か。手動で締め切られていない かつ サーバ時刻が締切前。 */
export function isRoundOpen(round: StoredRound, now: number): boolean {
  return round.closedAtMs === null && now < round.deadlineMs;
}

export function toRoundSummary(round: StoredRound | null, now: number): RoundSummary | null {
  if (!round) return null;
  return {
    key: round.key,
    open: isRoundOpen(round, now),
    openedAtMs: round.openedAtMs,
    deadlineMs: round.deadlineMs,
    answerCount: round.answerCount,
  };
}

/** ホスト(現在のホスト端末)が回答の受付を開始する。締切はサーバ時刻で決まり、ホストのタブが落ちても自動で締まる。 */
export async function openRound(deps: EngineDeps, args: OpenRoundArgs): Promise<OpenRoundResult> {
  const { meta, device } = await authenticate(deps, args);
  if (device.role !== "host" || meta.hostDeviceId !== device.deviceId) {
    throw hubError("NOT_HOST", "現在のホスト端末だけが回答の受付を開始できます");
  }
  if (!ROUND_KEY_PATTERN.test(args.key ?? "")) throw hubError("INVALID_ARGUMENT", "key が不正です");
  if (!Number.isFinite(args.durationMs) || args.durationMs < MIN_ROUND_DURATION_MS || args.durationMs > MAX_ROUND_DURATION_MS) {
    throw hubError("INVALID_ARGUMENT", "受付時間が範囲外です");
  }
  const options = args.options;
  if (!Array.isArray(options) || options.length < 2 || options.length > MAX_ROUND_OPTIONS) {
    throw hubError("INVALID_ARGUMENT", `選択肢は2〜${MAX_ROUND_OPTIONS}個で指定してください`);
  }
  const nos = new Set<number>();
  for (const o of options) {
    if (!Number.isInteger(o?.no) || o.no < 1 || o.no > 99 || nos.has(o.no)) {
      throw hubError("INVALID_ARGUMENT", "選択肢の番号が不正です(1〜99の重複しない整数)");
    }
    if (typeof o.text !== "string" || o.text.length > MAX_ROUND_OPTION_TEXT) {
      throw hubError("INVALID_ARGUMENT", "選択肢の文字列が不正です");
    }
    nos.add(o.no);
  }

  const now = deps.now();
  const existing = await deps.repo.getRound();
  // ホストのリロードなどで同じラウンドの開始が再送されても、回答を消さずに続きとして扱う。
  if (existing && existing.key === args.key && isRoundOpen(existing, now)) {
    return { key: existing.key, deadlineMs: existing.deadlineMs, serverNowMs: now };
  }
  const round = { key: args.key, optionNos: [...nos].sort((a, b) => a - b), openedAtMs: now, deadlineMs: now + args.durationMs };
  await deps.repo.openRound(round);
  const head = (await deps.repo.getHead()) ?? EMPTY_HEAD(meta);
  if (!head.hasRound) await deps.repo.putHead({ ...head, hasRound: true });
  return { key: round.key, deadlineMs: round.deadlineMs, serverNowMs: now };
}

/** ホストまたは管理端末が受付を締め切る(締切済みなら何もしない)。 */
export async function closeRound(deps: EngineDeps, args: CloseRoundArgs): Promise<RoundSummary> {
  const { device } = await authenticate(deps, args);
  if (device.role === "client") throw hubError("FORBIDDEN", "参加者は受付を締め切れません");
  const now = deps.now();
  const round = await deps.repo.getRound();
  if (!round || round.key !== args.key) throw hubError("ROUND_NOT_OPEN", "該当する回答受付がありません");
  await deps.repo.closeRound(now);
  return toRoundSummary({ ...round, closedAtMs: round.closedAtMs ?? now }, now)!;
}

/** 参加者の回答。先着で1人1回。締切の判定はサーバ時刻なので、端末の時計がずれていても公平。 */
export async function submitAnswer(deps: EngineDeps, args: SubmitAnswerArgs): Promise<SubmitAnswerResult> {
  const { device } = await authenticate(deps, args);
  if (device.role !== "client") throw hubError("FORBIDDEN", "回答できるのは参加者のみです");
  const now = deps.now();
  const round = await deps.repo.getRound();
  if (!round || round.key !== args.key) throw hubError("ROUND_NOT_OPEN", "いまは回答を受け付けていません");

  // すでに回答済みなら、締切後でも「回答済み」として最初の回答を返す(画面表示を揃えるため)。
  if (!isRoundOpen(round, now)) {
    const mine = (await deps.repo.listAnswers(round.key)).find((a) => a.deviceId === device.deviceId);
    if (mine) return { no: mine.no, atMs: mine.atMs, duplicate: true };
    throw hubError("ROUND_CLOSED", "回答の受付は終了しました");
  }
  if (!Number.isInteger(args.no) || !round.optionNos.includes(args.no)) {
    throw hubError("INVALID_ARGUMENT", "選択肢の番号が不正です");
  }
  const answer: RoundAnswer = {
    deviceId: device.deviceId,
    memberId: device.memberId,
    label: device.label,
    no: args.no,
    atMs: now,
  };
  const result = await deps.repo.appendAnswer(round.key, answer, deps.maxAnswers ?? MAX_ROUND_ANSWERS_KV);
  if (result.full) throw hubError("PAYLOAD_TOO_LARGE", "回答数が上限に達しました");
  if (!result.inserted && result.existing) return { no: result.existing.no, atMs: result.existing.atMs, duplicate: true };
  return { no: answer.no, atMs: answer.atMs, duplicate: false };
}

/** ホスト/管理が、回答の一覧(正誤・順位の集計に使う)を取得する。 */
export async function getAnswers(deps: EngineDeps, args: GetAnswersArgs): Promise<GetAnswersResult> {
  const { device } = await authenticate(deps, args);
  if (device.role === "client") throw hubError("FORBIDDEN", "参加者は回答一覧を取得できません");
  const now = deps.now();
  const round = await deps.repo.getRound();
  if (!round || round.key !== args.key) throw hubError("ROUND_NOT_OPEN", "該当する回答受付がありません");
  const answers = (await deps.repo.listAnswers(round.key)).slice().sort((a, b) => a.atMs - b.atMs);
  return { round: toRoundSummary(round, now)!, answers };
}
