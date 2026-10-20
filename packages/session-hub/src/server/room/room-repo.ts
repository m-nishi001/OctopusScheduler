/** Durable Object のストレージ上のセッション永続化。 */
import type { Command, Device, RoomState, SessionMeta } from "../../shared/session-types";
import { COMMAND_RING_SIZE } from "../../shared/session-types";
import type { RoundAnswer } from "../../shared/protocol";
import { upsertAnswer } from "../engine/round-answers";
import type { SessionRepo, StoredHead, StoredRound } from "../engine/session-repo";
import type { RoomStorage } from "./room-types";

/** createRoomRepo の戻り値。回答は書き込みをまとめるため、flush で永続化する。 */
export interface RoomRepo extends SessionRepo {
  /** 回答のメモリ上の変更を永続化する。alarm と締切・終了時に呼ぶ。 */
  flush(): Promise<void>;
  /** 永続化されていない回答があるか。 */
  hasPendingWrites(): boolean;
}

/**
 * DO ストレージ上のセッション永続化(KV版と同じ形・同じキー粒度)。
 *
 * 回答ラウンドだけは、参加者数百人が一斉に答えても書き込み行数が増えないよう、回答をメモリに
 * 溜めて alarm でまとめて書く(回答1件ごとに書くと無料枠の書き込み行数を圧迫するため)。
 */
export function createRoomRepo(storage: RoomStorage): RoomRepo {
  const slot = (seq: number): string => `cmd:${seq % COMMAND_RING_SIZE}`;
  let roundCache: StoredRound | null | undefined;
  let answersCache: { key: string; answers: RoundAnswer[] } | null | undefined;
  // メモリ上の変更の版と、永続化できた版。差があれば未保存。書き込みに失敗しても未保存のまま残り、次の flush でやり直す。
  let version = 0;
  let persistedVersion = 0;

  const loadRound = async (): Promise<StoredRound | null> => {
    if (roundCache === undefined) roundCache = (await storage.get<StoredRound>("round")) ?? null;
    return roundCache;
  };
  const loadAnswers = async (): Promise<{ key: string; answers: RoundAnswer[] } | null> => {
    if (answersCache === undefined) {
      answersCache = (await storage.get<{ key: string; answers: RoundAnswer[] }>("answers")) ?? null;
    }
    return answersCache;
  };
  /**
   * 未保存の変更を書く。書き込みに失敗したら例外を投げ、未保存のまま残す
   * (alarm から呼ばれたときは、例外で Cloudflare が alarm を再試行する)。
   * 書き込み中に入った新しい変更は、次の flush で書く。
   */
  const flush = async (): Promise<void> => {
    if (persistedVersion === version) return;
    const target = version;
    if (answersCache) await storage.put("answers", answersCache);
    if (roundCache) await storage.put("round", roundCache);
    persistedVersion = target;
  };

  return {
    getMeta: async () => (await storage.get<SessionMeta>("meta")) ?? null,
    putMeta: (meta) => storage.put("meta", meta),
    getHead: async () => (await storage.get<StoredHead>("head")) ?? null,
    putHead: (head) => storage.put("head", head),
    getState: async () => (await storage.get<RoomState>("state")) ?? null,
    putState: (state) => storage.put("state", state),
    getDevice: async (id) => (await storage.get<Device>(`dev:${id}`)) ?? null,
    putDevice: (device) => storage.put(`dev:${device.deviceId}`, device),
    getCommand: async (seq) => (await storage.get<Command>(slot(seq))) ?? null,
    putCommand: (command) => storage.put(slot(command.seq), command),

    getRound: loadRound,
    async openRound(round) {
      roundCache = { ...round, closedAtMs: null, answerCount: 0, answerRev: 0 };
      answersCache = { key: round.key, answers: [] };
      await storage.put("answers", answersCache);
      await storage.put("round", roundCache);
      persistedVersion = ++version;
    },
    async closeRound(closedAtMs) {
      const round = await loadRound();
      if (!round || round.closedAtMs !== null) return;
      roundCache = { ...round, closedAtMs };
      version++;
      await flush();
    },
    async reopenRound(deadlineMs) {
      const round = await loadRound();
      if (!round) return;
      roundCache = { ...round, closedAtMs: null, deadlineMs };
      version++;
      await flush();
    },
    async listAnswers(key) {
      const stored = await loadAnswers();
      return stored && stored.key === key ? stored.answers : [];
    },
    async upsertAnswer(key, answer, maxAnswers) {
      const round = await loadRound();
      const stored = await loadAnswers();
      if (!round || !stored || stored.key !== key) return null;
      const result = upsertAnswer(stored.answers, answer, maxAnswers);
      if (result.kind === "inserted" || result.kind === "replaced") {
        roundCache = { ...round, answerCount: stored.answers.length, answerRev: round.answerRev + 1 };
        version++;
      }
      return result;
    },
    flush,
    hasPendingWrites: () => persistedVersion !== version,
  };
}
