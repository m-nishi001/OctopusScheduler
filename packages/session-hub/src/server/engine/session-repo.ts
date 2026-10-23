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
import { isSameRespondent, upsertAnswer, type UpsertAnswerResult } from "./round-answers";
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
  /** 回答が新しく入る/選び直されるたびに増える。回答数が変わらない選び直しも、運営端末が検知できるようにする。 */
  answerRev: number;
}

export interface SessionRepo {
  /**
   * このセッションの保存データをすべて消す(終わって一覧から外れたセッションの掃除)。
   * 容量に上限のある保存先(GAS の ScriptProperty は全体で約500KB)のために、KV 実装だけが持つ。
   */
  purge?(): Promise<void>;
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
  openRound(round: Omit<StoredRound, "answerCount" | "answerRev" | "closedAtMs">): Promise<void>;
  /** 締め切る(すでに締切済みなら何もしない)。 */
  closeRound(closedAtMs: number): Promise<void>;
  /** 締切済みのラウンドを、回答を残したまま再開する(新しい締切を設定し、締切済みの印を外す)。 */
  reopenRound(deadlineMs: number): Promise<void>;
  listAnswers(key: string): Promise<RoundAnswer[]>;
  /**
   * 受付中の回答を反映する。1人1件で、同じ参加者が別の選択肢を送ると置き換わる(`upsertAnswer`)。
   * ラウンドが無い/key が違うときは null。
   */
  upsertAnswer(key: string, answer: RoundAnswer, maxAnswers: number): Promise<UpsertAnswerResult | null>;
  /**
   * 参加者名簿(ポータルから入室したことのあるメンバーのID)に追加する。すでに入っていれば何もしない(書き込みもしない)。
   * 保存するのはメンバーIDだけ。
   */
  addParticipant(memberId: string): Promise<void>;
  /** 参加者名簿のメンバーID(入室した順)。 */
  listParticipantIds(): Promise<string[]>;
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

/** セッション1件の保存先(`SessionRepo`)を、KV(GAS / R2)の上に作る。キーは `session-hub/s/<sessionId>/…`。 */
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
    async purge() {
      await storage.deleteScalarsByPrefix(k(""));
    },
    ...createKvRoundOps(storage, k),
    ...createKvParticipantOps(storage, k),
  };
}

/**
 * 1つのキーに入れるメンバーIDの数。1件 数十バイトなので、GAS の 1 値の上限(約9KB)に十分収まる。
 */
export const PARTICIPANT_CHUNK_SIZE = 100;

/** 参加者名簿の KV 実装。participants/0, participants/1, …(メンバーIDの配列を PARTICIPANT_CHUNK_SIZE 件ずつ)。 */
function createKvParticipantOps(
  storage: IKeyValueStorage,
  k: (name: string) => string
): Pick<SessionRepo, "addParticipant" | "listParticipantIds"> {
  const chunkKey = (index: number): string => k(`participants/${index}`);
  const readChunks = async (): Promise<string[][]> => {
    const chunks: string[][] = [];
    for (let i = 0; ; i++) {
      const stored = await readJson<string[]>(storage, chunkKey(i));
      if (!stored) break;
      chunks.push(stored);
      if (stored.length < PARTICIPANT_CHUNK_SIZE) break;
    }
    return chunks;
  };
  return {
    async listParticipantIds() {
      return (await readChunks()).flat();
    },
    async addParticipant(memberId) {
      const chunks = await readChunks();
      if (chunks.some((c) => c.includes(memberId))) return;
      const last = chunks[chunks.length - 1];
      if (last && last.length < PARTICIPANT_CHUNK_SIZE) {
        await storage.set(chunkKey(chunks.length - 1), JSON.stringify([...last, memberId]));
      } else {
        await storage.set(chunkKey(chunks.length), JSON.stringify([memberId]));
      }
    },
  };
}

/**
 * 1つのキーに入れる回答の数。1件 約200〜300バイトなので、GAS の 1 値の上限(約9KB)に収まる大きさ。
 * 回答の上限(MAX_ROUND_ANSWERS_KV)はこの数で何個かのキーに分けて保存する。
 */
export const ANSWER_CHUNK_SIZE = 25;

interface AnswerChunk {
  key: string;
  answers: RoundAnswer[];
}

/**
 * 回答ラウンドの KV 実装。round(要約)と、answers/0, answers/1, …(回答を ANSWER_CHUNK_SIZE 件ずつ)を別々のキーに持つ。
 * 前のラウンドのキーが残っていても、ラウンドの key が違えば無視する。
 */
function createKvRoundOps(
  storage: IKeyValueStorage,
  k: (name: string) => string
): Pick<SessionRepo, "getRound" | "openRound" | "closeRound" | "reopenRound" | "listAnswers" | "upsertAnswer"> {
  const chunkKey = (index: number): string => k(`answers/${index}`);

  /** このラウンドの回答のかたまりを、先頭から順に読む(満杯でないかたまりが最後)。 */
  const readChunks = async (key: string): Promise<RoundAnswer[][]> => {
    const chunks: RoundAnswer[][] = [];
    for (let i = 0; ; i++) {
      const stored = await readJson<AnswerChunk>(storage, chunkKey(i));
      if (!stored || stored.key !== key) break;
      chunks.push(stored.answers);
      if (stored.answers.length < ANSWER_CHUNK_SIZE) break;
    }
    return chunks;
  };
  return {
    getRound: () => readJson<StoredRound>(storage, k("round")),
    async openRound(round) {
      await storage.set(chunkKey(0), JSON.stringify({ key: round.key, answers: [] } satisfies AnswerChunk));
      await storage.set(k("round"), JSON.stringify({ ...round, closedAtMs: null, answerCount: 0, answerRev: 0 } satisfies StoredRound));
    },
    async closeRound(closedAtMs) {
      const round = await readJson<StoredRound>(storage, k("round"));
      if (!round || round.closedAtMs !== null) return;
      await storage.set(k("round"), JSON.stringify({ ...round, closedAtMs }));
    },
    async reopenRound(deadlineMs) {
      const round = await readJson<StoredRound>(storage, k("round"));
      if (!round) return;
      await storage.set(k("round"), JSON.stringify({ ...round, closedAtMs: null, deadlineMs }));
    },
    async listAnswers(key) {
      return (await readChunks(key)).flat();
    },
    async upsertAnswer(key, answer, maxAnswers) {
      const round = await readJson<StoredRound>(storage, k("round"));
      if (!round || round.key !== key) return null;
      const answers = (await readChunks(key)).flat();
      const previousIndex = answers.findIndex((a) => isSameRespondent(a, answer));
      const result = upsertAnswer(answers, answer, maxAnswers);
      if (result.kind === "inserted" || result.kind === "replaced") {
        // 変わったかたまり(選び直しは元の位置、新規は末尾)だけを書く
        const changedIndex = previousIndex >= 0 ? previousIndex : answers.length - 1;
        for (let i = Math.floor(changedIndex / ANSWER_CHUNK_SIZE); i * ANSWER_CHUNK_SIZE < answers.length; i++) {
          const chunk: AnswerChunk = { key, answers: answers.slice(i * ANSWER_CHUNK_SIZE, (i + 1) * ANSWER_CHUNK_SIZE) };
          await storage.set(chunkKey(i), JSON.stringify(chunk));
        }
        await storage.set(k("round"), JSON.stringify({ ...round, answerCount: answers.length, answerRev: round.answerRev + 1 } satisfies StoredRound));
      }
      return result;
    },
  };
}

/** セッションの一覧(索引)の保存先を、KV の上に作る。 */
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
