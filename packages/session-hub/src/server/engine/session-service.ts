/**
 * セッションの作成・一覧・終了と、参加コードによる入室。
 * 個々のセッション内の操作は session-engine.ts。ここは「複数セッションをまたぐ」層で、
 * 書き込みは ILock で直列化する。
 */
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  MAX_ACTIVE_SESSIONS,
  SESSION_MODES,
  SESSION_TTL_MS,
} from "../../shared/session-types";
import type { SessionMeta, SessionSummary } from "../../shared/session-types";
import type {
  CloseSessionArgs,
  CreateSessionArgs,
  JoinClientArgs,
  JoinOperatorArgs,
  JoinResult,
} from "../../shared/protocol";
import * as engine from "./session-engine";
import type { EngineDeps } from "./session-engine";
import { hubError } from "./hub-error";
import type { PresenceStore, SessionIndexStore, SessionRepo } from "./session-repo";

export interface ServiceDeps {
  index: SessionIndexStore;
  repoFor: (sessionId: string) => SessionRepo;
  presenceFor: (sessionId: string) => PresenceStore;
  withLock: <T>(key: string, timeoutMs: number, fn: () => Promise<T> | T) => Promise<T>;
  now: () => number;
  newId: () => string;
  newToken: () => string;
}

const LOCK_TIMEOUT_MS = 5000;
/** 終了済みセッションを一覧に残す時間。 */
const CLOSED_KEEP_MS = 60 * 60 * 1000;
const MAX_NAME_LENGTH = 60;

const INDEX_LOCK = "session-hub:index";
const sessionLock = (id: string): string => `session-hub:s:${id}`;

function engineDeps(deps: ServiceDeps, sessionId: string): EngineDeps {
  return {
    repo: deps.repoFor(sessionId),
    presence: deps.presenceFor(sessionId),
    now: deps.now,
    newId: deps.newId,
    newToken: deps.newToken,
  };
}

/** `newId()` の16進文字から、紛らわしい文字を除いた参加コードを作る。 */
export function generateJoinCode(newId: () => string): string {
  let source = "";
  while (source.length < JOIN_CODE_LENGTH * 2) source += newId().replace(/[^0-9a-f]/gi, "");
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    const pair = parseInt(source.slice(i * 2, i * 2 + 2), 16);
    code += JOIN_CODE_ALPHABET[pair % JOIN_CODE_ALPHABET.length];
  }
  return code;
}

function summarize(meta: SessionMeta): SessionSummary {
  return {
    id: meta.id,
    code: meta.code,
    name: meta.name,
    status: meta.status,
    mode: meta.mode,
    ownerMemberId: meta.ownerMemberId,
    createdAtMs: meta.createdAtMs,
  };
}

/** 期限切れ・終了から一定時間経ったセッションを一覧から外す。 */
function prune(list: SessionSummary[], now: number): SessionSummary[] {
  return list.filter((s) => {
    if (s.status === "closed") return now - (s.closedAtMs ?? s.createdAtMs) < CLOSED_KEEP_MS;
    return now - s.createdAtMs < SESSION_TTL_MS;
  });
}

function isActive(s: SessionSummary): boolean {
  return s.status !== "closed";
}

export async function createSession(
  deps: ServiceDeps,
  args: CreateSessionArgs,
  ownerMemberId: string
): Promise<SessionMeta> {
  const name = (args.name ?? "").trim().slice(0, MAX_NAME_LENGTH);
  if (!name) throw hubError("INVALID_ARGUMENT", "セッション名を入力してください");
  const mode = args.mode ?? "live";
  if (!(SESSION_MODES as readonly string[]).includes(mode)) {
    throw hubError("INVALID_ARGUMENT", "mode が不正です");
  }

  return deps.withLock(INDEX_LOCK, LOCK_TIMEOUT_MS, async () => {
    const now = deps.now();
    const list = prune(await deps.index.list(), now);
    if (list.filter(isActive).length >= MAX_ACTIVE_SESSIONS) {
      throw hubError("TOO_MANY_SESSIONS", "進行中のセッションが多すぎます。不要なセッションを終了してください");
    }
    const usedCodes = new Set(list.filter(isActive).map((s) => s.code));
    let code = generateJoinCode(deps.newId);
    for (let i = 0; usedCodes.has(code) && i < 20; i++) code = generateJoinCode(deps.newId);
    if (usedCodes.has(code)) throw hubError("TOO_MANY_SESSIONS", "参加コードを割り当てられませんでした");

    const meta: SessionMeta = {
      id: deps.newId(),
      code,
      name,
      ownerMemberId,
      status: "lobby",
      mode,
      createdAtMs: now,
      expiresAtMs: now + SESSION_TTL_MS,
      hostDeviceId: null,
    };
    await deps.repoFor(meta.id).putMeta(meta);
    await deps.index.put([...list, summarize(meta)]);
    return meta;
  });
}

export async function listSessions(deps: ServiceDeps): Promise<SessionSummary[]> {
  const now = deps.now();
  return prune(await deps.index.list(), now);
}

export async function closeSession(deps: ServiceDeps, args: CloseSessionArgs): Promise<void> {
  if (!args.sessionId) throw hubError("INVALID_ARGUMENT", "sessionId が必要です");
  await deps.withLock(INDEX_LOCK, LOCK_TIMEOUT_MS, async () => {
    const repo = deps.repoFor(args.sessionId);
    const meta = await repo.getMeta();
    if (!meta) throw hubError("SESSION_NOT_FOUND", "セッションが見つかりません");
    if (meta.status !== "closed") await repo.putMeta({ ...meta, status: "closed" });
    const list = await deps.index.list();
    const closedAtMs = deps.now();
    await deps.index.put(
      list.map((s) => (s.id === meta.id ? { ...s, status: "closed" as const, closedAtMs } : s))
    );
  });
}

export async function joinOperator(
  deps: ServiceDeps,
  args: JoinOperatorArgs,
  memberId: string
): Promise<JoinResult> {
  if (!args.sessionId) throw hubError("INVALID_ARGUMENT", "sessionId が必要です");
  return deps.withLock(sessionLock(args.sessionId), LOCK_TIMEOUT_MS, () =>
    engine.joinOperator(engineDeps(deps, args.sessionId), args, memberId)
  );
}

export async function joinClient(deps: ServiceDeps, args: JoinClientArgs): Promise<JoinResult> {
  const code = (args.code ?? "").trim().toUpperCase();
  if (!code) throw hubError("INVALID_ARGUMENT", "参加コードを入力してください");
  const summary = (await deps.index.list()).find((s) => s.code === code && isActive(s));
  if (!summary) throw hubError("SESSION_NOT_FOUND", "参加コードが見つかりません。コードを確認してください");
  return deps.withLock(sessionLock(summary.id), LOCK_TIMEOUT_MS, () =>
    engine.joinClient(engineDeps(deps, summary.id), args)
  );
}

export async function poll(deps: ServiceDeps, args: Parameters<typeof engine.poll>[1]) {
  // 読み取りのみ(在席の書き込みはロック不要)。ロックを取ると全クライアントのポーリングが直列化する。
  return engine.poll(engineDeps(deps, args.sessionId), args);
}

export async function issueCommand(deps: ServiceDeps, args: Parameters<typeof engine.issueCommand>[1]) {
  return deps.withLock(sessionLock(args.sessionId), LOCK_TIMEOUT_MS, () =>
    engine.issueCommand(engineDeps(deps, args.sessionId), args)
  );
}

export async function publishState(deps: ServiceDeps, args: Parameters<typeof engine.publishState>[1]) {
  return deps.withLock(sessionLock(args.sessionId), LOCK_TIMEOUT_MS, () =>
    engine.publishState(engineDeps(deps, args.sessionId), args)
  );
}

export async function openRound(deps: ServiceDeps, args: Parameters<typeof engine.openRound>[1]) {
  return deps.withLock(sessionLock(args.sessionId), LOCK_TIMEOUT_MS, () =>
    engine.openRound(engineDeps(deps, args.sessionId), args)
  );
}

export async function closeRound(deps: ServiceDeps, args: Parameters<typeof engine.closeRound>[1]) {
  return deps.withLock(sessionLock(args.sessionId), LOCK_TIMEOUT_MS, () =>
    engine.closeRound(engineDeps(deps, args.sessionId), args)
  );
}

/** 回答は配列の読み書きなので、同一セッション内でロックして先着判定と件数を正しく保つ。 */
export async function submitAnswer(deps: ServiceDeps, args: Parameters<typeof engine.submitAnswer>[1]) {
  return deps.withLock(sessionLock(args.sessionId), LOCK_TIMEOUT_MS, () =>
    engine.submitAnswer(engineDeps(deps, args.sessionId), args)
  );
}

export async function getAnswers(deps: ServiceDeps, args: Parameters<typeof engine.getAnswers>[1]) {
  return engine.getAnswers(engineDeps(deps, args.sessionId), args);
}
