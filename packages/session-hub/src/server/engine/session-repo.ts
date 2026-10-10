/**
 * セッション1件ぶんの永続化の抽象。エンジンはこれだけに依存するので、
 * GAS/Cloudflare(R2)では KV 実装、Durable Object では DO ストレージ実装に差し替えられる。
 *
 * 各値は小さく保つ(GAS の PropertiesService は 1 値 ~9KB まで):
 *   meta / head / state / device(1端末1キー) / command(リングの1スロット1キー)。
 */
import type { IKeyValueStorage, ICache } from "@octopus/infrastructures/interfaces";
import { COMMAND_RING_SIZE } from "../../shared/session-types";
import type { RoundAnswer } from "../../shared/protocol";
import type {
  Command,
  Device,
  PresenceEntry,
  RoomState,
  SessionMeta,
  SessionSummary,
} from "../../shared/session-types";

export interface RecentRequest {
  requestId: string;
  seq: number;
}

export interface StoredHead {
  seq: number;
  stateVersion: number;
  updatedAtMs: number;
  /** 直近に受理したコマンドの requestId(重複送信を同じ seq で返すため)。 */
  recent: RecentRequest[];
  /** 回答ラウンドが一度でも開始された。false の間は poll でラウンドを読まない(読み取り回数の節約)。 */
  hasRound?: boolean;
}

/** 回答ラウンド(同時に進行できるのは1つ)。選択肢の番号と、サーバ時刻の締切を持つ。 */
export interface StoredRound {
  key: string;
  optionNos: number[];
  openedAtMs: number;
  deadlineMs: number;
  /** 手動/自動で締め切った時刻。受付中は null。 */
  closedAtMs: number | null;
  answerCount: number;
}

export interface AppendAnswerResult {
  inserted: boolean;
  /** inserted が false のとき、すでに採用されている回答。 */
  existing: RoundAnswer | null;
  /** 上限に達していて受け付けられなかった。 */
  full: boolean;
}

export interface SessionRepo {
  getMeta(): Promise<SessionMeta | null>;
  putMeta(meta: SessionMeta): Promise<void>;
  getHead(): Promise<StoredHead | null>;
  putHead(head: StoredHead): Promise<void>;
  getState(): Promise<RoomState | null>;
  putState(state: RoomState): Promise<void>;
  getDevice(deviceId: string): Promise<Device | null>;
  putDevice(device: Device): Promise<void>;
  /** seq に対応するスロット(seq % COMMAND_RING_SIZE)の内容。 */
  getCommand(seq: number): Promise<Command | null>;
  putCommand(command: Command): Promise<void>;
  getRound(): Promise<StoredRound | null>;
  /** 新しいラウンドを開始する。前のラウンドの回答は破棄される。 */
  openRound(round: Omit<StoredRound, "answerCount" | "closedAtMs">): Promise<void>;
  /** 締め切る(すでに締切済みなら何もしない)。 */
  closeRound(closedAtMs: number): Promise<void>;
  listAnswers(key: string): Promise<RoundAnswer[]>;
  /** 先着で採用する。同じ端末の2回目以降は inserted=false で既存を返す。上限なら full=true。 */
  appendAnswer(key: string, answer: RoundAnswer, maxAnswers: number): Promise<AppendAnswerResult>;
}

/** 全セッション共通の一覧インデックス。 */
export interface SessionIndexStore {
  list(): Promise<SessionSummary[]>;
  put(list: SessionSummary[]): Promise<void>;
}

/** 端末の在席情報。ポーリングごとに更新されるため永続ストレージには書かない。 */
export interface PresenceStore {
  /** 在席を記録し、記録後の全端末の在席を返す(読み取り1回で済ませるため)。実装は書き込みを間引いてよい。 */
  touch(entry: PresenceEntry): Promise<PresenceEntry[]>;
  list(): Promise<PresenceEntry[]>;
}

// ---- KV 実装 ----

async function readJson<T>(storage: IKeyValueStorage, key: string): Promise<T | null> {
  const raw = await storage.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const slotOf = (seq: number): number => seq % COMMAND_RING_SIZE;

export function createKvSessionRepo(storage: IKeyValueStorage, sessionId: string): SessionRepo {
  const k = (name: string): string => `session-hub/s/${sessionId}/${name}`;
  return {
    getMeta: () => readJson<SessionMeta>(storage, k("meta")),
    putMeta: (meta) => storage.set(k("meta"), JSON.stringify(meta)),
    getHead: () => readJson<StoredHead>(storage, k("head")),
    putHead: (head) => storage.set(k("head"), JSON.stringify(head)),
    getState: () => readJson<RoomState>(storage, k("state")),
    putState: (state) => storage.set(k("state"), JSON.stringify(state)),
    getDevice: (deviceId) => readJson<Device>(storage, k(`dev/${deviceId}`)),
    putDevice: (device) => storage.set(k(`dev/${device.deviceId}`), JSON.stringify(device)),
    getCommand: (seq) => readJson<Command>(storage, k(`cmd/${slotOf(seq)}`)),
    putCommand: (command) => storage.set(k(`cmd/${slotOf(command.seq)}`), JSON.stringify(command)),
    ...createKvRoundOps(storage, k),
  };
}

/** 回答ラウンドの KV 実装。round(要約)と answers(回答の配列)をそれぞれ1キーに持つ(GAS の1値 ~9KB 以内)。 */
function createKvRoundOps(
  storage: IKeyValueStorage,
  k: (name: string) => string
): Pick<SessionRepo, "getRound" | "openRound" | "closeRound" | "listAnswers" | "appendAnswer"> {
  const readAnswers = async (key: string): Promise<RoundAnswer[]> => {
    const stored = await readJson<{ key: string; answers: RoundAnswer[] }>(storage, k("answers"));
    return stored && stored.key === key ? stored.answers : [];
  };
  return {
    getRound: () => readJson<StoredRound>(storage, k("round")),
    async openRound(round) {
      await storage.set(k("answers"), JSON.stringify({ key: round.key, answers: [] }));
      await storage.set(k("round"), JSON.stringify({ ...round, closedAtMs: null, answerCount: 0 } satisfies StoredRound));
    },
    async closeRound(closedAtMs) {
      const round = await readJson<StoredRound>(storage, k("round"));
      if (!round || round.closedAtMs !== null) return;
      await storage.set(k("round"), JSON.stringify({ ...round, closedAtMs }));
    },
    listAnswers: readAnswers,
    async appendAnswer(key, answer, maxAnswers) {
      const answers = await readAnswers(key);
      const existing = answers.find((a) => a.deviceId === answer.deviceId) ?? null;
      if (existing) return { inserted: false, existing, full: false };
      if (answers.length >= maxAnswers) return { inserted: false, existing: null, full: true };
      answers.push(answer);
      await storage.set(k("answers"), JSON.stringify({ key, answers }));
      const round = await readJson<StoredRound>(storage, k("round"));
      if (round) await storage.set(k("round"), JSON.stringify({ ...round, answerCount: answers.length }));
      return { inserted: true, existing: null, full: false };
    },
  };
}

export function createKvSessionIndex(storage: IKeyValueStorage): SessionIndexStore {
  const key = "session-hub/index";
  return {
    async list() {
      return (await readJson<SessionSummary[]>(storage, key)) ?? [];
    },
    put: (list) => storage.set(key, JSON.stringify(list)),
  };
}

/** 在席の書き込みを間引く間隔。これより新しい記録は更新しない(ackSeq が進んだ場合を除く)。 */
export const PRESENCE_WRITE_INTERVAL_MS = 10_000;
const PRESENCE_CACHE_TTL_SECONDS = 6 * 60 * 60;

/**
 * ICache 上の1キーに全端末の在席をまとめる。読み書きは競合し得る(後勝ち)が、
 * 在席は表示用の近似値なので許容する。書き込みは端末あたり10秒に1回まで。
 */
export function createCachePresenceStore(
  cache: ICache,
  sessionId: string,
  now: () => number
): PresenceStore {
  const key = `session-hub/presence/${sessionId}`;
  const read = async (): Promise<Record<string, PresenceEntry>> => {
    const raw = await cache.get(key);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, PresenceEntry>;
    } catch {
      return {};
    }
  };
  return {
    async touch(entry) {
      const map = await read();
      const prev = map[entry.deviceId];
      if (
        prev &&
        prev.ackSeq === entry.ackSeq &&
        prev.label === entry.label &&
        entry.seenAtMs - prev.seenAtMs < PRESENCE_WRITE_INTERVAL_MS
      ) {
        return Object.values(map);
      }
      map[entry.deviceId] = entry;
      // 古い記録を落としてサイズを抑える
      const cutoff = now() - 10 * 60 * 1000;
      for (const [id, e] of Object.entries(map)) if (e.seenAtMs < cutoff) delete map[id];
      await cache.put(key, JSON.stringify(map), PRESENCE_CACHE_TTL_SECONDS);
      return Object.values(map);
    },
    async list() {
      return Object.values(await read());
    },
  };
}
