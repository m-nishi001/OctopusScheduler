import {
  ENTRY_OPTIONS,
  PORTAL_EVENT_CLOSE_ENTRY,
  PORTAL_EVENT_END,
  PORTAL_EVENT_NS,
  PORTAL_EVENT_OPEN_ENTRY,
  PORTAL_EVENT_SET_POOL,
  PORTAL_EVENT_START,
  entryRoundKey,
  parseEventStartPayload,
  parseHubErrorCode,
  parseSetPoolPayload,
  readPortalEvent,
  uniqueAnswers,
} from "@octopus/session-hub";
import type { HostAgent, PortalEvent } from "@octopus/session-hub";
import type { DrawPoolProvider } from "@octopus/game-jackpot";

/** ホストをリロードしても、発生中のイベントを参加者に出し続けるための保存先(セッションごと)。 */
export interface EventStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const STORAGE_PREFIX = "octopus.host.event:";
/** 抽選に使うエントリー者の一覧（直近に取得できたもの）。回答ラウンドが別の受付に置き換わっても抽選できるように残す。 */
const ENTRANTS_PREFIX = "octopus.host.entrants:";

export function browserEventStorage(): EventStorage {
  return {
    get: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // 保存できなくても、イベントの公開自体は続けられる(リロード時に復元できないだけ)
      }
    },
    remove: (key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // 同上
      }
    },
  };
}

export interface EventHostOptions {
  storage?: EventStorage;
  now?: () => number;
  newId?: () => string;
}

const defaultNewId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * ホストが `event` 名前空間のコマンドを受け、参加者ポータルに出すイベントとエントリー受付を公開する。
 *   - `event.start { title }` : イベントを開始する(発生中のイベントがあれば置き換える。エントリーは引き継がない)
 *   - `event.end`             : イベントを終了する(受付中のエントリーも締め切る)
 *   - `event.openEntry`       : エントリー受付を開始する。締切後なら、エントリー済みの人を残したまま再開する
 *   - `event.closeEntry`      : エントリー受付を締め切る
 * 発生中のイベントはセッションごとに端末へ保存し、ホストがリロード・再接続しても公開し直す。
 * 受付そのものは回答ラウンドとしてサーバー側に残るので、リロードしても受付中の人数は失われない。
 */
export function registerEventHost(agent: HostAgent, options: EventHostOptions = {}): () => void {
  const storage = options.storage ?? browserEventStorage();
  const now = options.now ?? (() => Date.now());
  const newId = options.newId ?? defaultNewId;
  const keyFor = (sessionId: string): string => `${STORAGE_PREFIX}${sessionId}`;
  const currentSessionId = (): string | null => agent.connection.state.session?.id ?? null;

  const load = (sessionId: string | null): PortalEvent | null => {
    if (!sessionId) return null;
    const raw = storage.get(keyFor(sessionId));
    if (!raw) return null;
    try {
      return readPortalEvent({ [PORTAL_EVENT_NS]: JSON.parse(raw) });
    } catch {
      return null;
    }
  };
  const save = async (sessionId: string | null, event: PortalEvent): Promise<void> => {
    if (sessionId) storage.set(keyFor(sessionId), JSON.stringify(event));
    await agent.publishSlice(PORTAL_EVENT_NS, event);
  };

  /** 受付の締切。すでに無い・締切済みのときは何もしない（サーバー側で ROUND_NOT_OPEN になる）。 */
  const closeRoundQuietly = async (key: string): Promise<void> => {
    try {
      await agent.connection.closeRound(key);
    } catch (error) {
      if (parseHubErrorCode(error instanceof Error ? error.message : "") !== "ROUND_NOT_OPEN") console.warn("エントリーの締切に失敗しました", error);
    }
  };

  /** 受付のエントリー者(ログイン済みのメンバーID)を取得して保存する。取得できなければ何もしない。 */
  const snapshotEntrants = async (event: PortalEvent | null): Promise<void> => {
    const sessionId = currentSessionId();
    if (!sessionId || !event?.entry) return;
    try {
      await fetchEntrantIds(agent, storage, sessionId, event.entry.key);
    } catch (error) {
      console.warn("エントリー者の一覧を保存できませんでした", error);
    }
  };

  const unregister = agent.router.register(PORTAL_EVENT_NS, async (command) => {
    const sessionId = currentSessionId();
    const event = load(sessionId);

    if (command.type === PORTAL_EVENT_START) {
      const parsed = parseEventStartPayload(command.payload);
      if (!parsed) return;
      if (event?.entry?.open) await closeRoundQuietly(event.entry.key);
      if (sessionId) storage.remove(entrantsKey(sessionId));
      await save(sessionId, { id: newId(), title: parsed.title, startedAtMs: now() });
    } else if (command.type === PORTAL_EVENT_END) {
      if (event?.entry?.open) await closeRoundQuietly(event.entry.key);
      if (sessionId) {
        storage.remove(keyFor(sessionId));
        storage.remove(entrantsKey(sessionId));
      }
      await agent.clearSlice(PORTAL_EVENT_NS);
    } else if (command.type === PORTAL_EVENT_OPEN_ENTRY) {
      if (!event || event.entry?.open) return;
      const key = event.entry?.key ?? entryRoundKey(event.id);
      try {
        // 以前に受付を始めたイベントなら、エントリー済みの人を残したまま再開する
        await agent.connection.openEntryRound(key, [...ENTRY_OPTIONS], event.entry !== undefined);
      } catch (error) {
        console.error("エントリー受付を開始できませんでした", error);
        return;
      }
      // エントリーの目的は抽選の対象を決めること。最初の受付では、抽選の対象を「エントリーした人」にする
      // （運営が「全メンバー」に戻せる）。
      await save(sessionId, { ...event, entry: { key, open: true }, pool: event.pool ?? "entrants" });
    } else if (command.type === PORTAL_EVENT_CLOSE_ENTRY) {
      if (!event?.entry?.open) return;
      await closeRoundQuietly(event.entry.key);
      // 締め切ったあとの確定した一覧を保存する（のちに別の回答受付が始まっても、抽選の対象が失われないように）
      await snapshotEntrants(event);
      await save(sessionId, { ...event, entry: { ...event.entry, open: false } });
    } else if (command.type === PORTAL_EVENT_SET_POOL) {
      const parsed = parseSetPoolPayload(command.payload);
      if (!event || !parsed || event.pool === parsed.mode) return;
      await save(sessionId, { ...event, pool: parsed.mode });
    }
  });

  // ホストとして(再)接続したら、保存してあるイベントを公開し直す。
  let restoredFor: string | null = null;
  const unsubscribe = agent.connection.subscribe((state) => {
    const sessionId = state.session?.id ?? null;
    if (state.phase !== "connected" || state.role !== "host" || !sessionId) {
      if (state.phase === "idle") restoredFor = null;
      return;
    }
    if (restoredFor === sessionId) return;
    restoredFor = sessionId;
    const raw = storage.get(keyFor(sessionId));
    if (!raw) return;
    const event = load(sessionId);
    if (event) void agent.publishSlice(PORTAL_EVENT_NS, event);
    else storage.remove(keyFor(sessionId));
  });

  return () => {
    unregister();
    unsubscribe();
  };
}

const entrantsKey = (sessionId: string): string => `${ENTRANTS_PREFIX}${sessionId}`;

interface EntrantSnapshot {
  /** どの受付（回答ラウンド）の一覧か。 */
  key: string;
  memberIds: string[];
}

/**
 * 受付の回答一覧から、抽選の対象にするメンバーID（ログインから確定した人、1人1件）を取得して保存する。
 * 取得に失敗したら例外を投げる（呼び出し側が、保存済みの一覧を使うか、エラーにするかを決める）。
 */
async function fetchEntrantIds(agent: HostAgent, storage: EventStorage, sessionId: string, key: string): Promise<string[]> {
  const { answers } = await agent.connection.getAnswers(key);
  const memberIds = uniqueAnswers(answers)
    .filter((a) => a.verified === true && a.memberId)
    .map((a) => a.memberId as string);
  const snapshot: EntrantSnapshot = { key, memberIds };
  storage.set(entrantsKey(sessionId), JSON.stringify(snapshot));
  return memberIds;
}

function loadEntrantSnapshot(storage: EventStorage, sessionId: string, key: string): string[] | null {
  const raw = storage.get(entrantsKey(sessionId));
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw) as Partial<EntrantSnapshot>;
    if (snapshot.key === key && Array.isArray(snapshot.memberIds) && snapshot.memberIds.every((id) => typeof id === "string")) {
      return snapshot.memberIds;
    }
  } catch {
    // 壊れた保存データは使わない
  }
  return null;
}

/**
 * ジャックポットの抽選の対象を、イベントの設定から決める。
 *   - 対象が「全メンバー」（または指定なし・イベントなし）なら絞り込まない（null）
 *   - 「エントリーした人だけ」なら、受付の回答一覧（ログインから確定した人）から取得する。取得できなければ
 *     直近に保存した一覧を使い、それも無ければ例外にする（全メンバーにフォールバックして、対象外の人が
 *     当選する事故を起こさない）
 */
export function createEntrantDrawPool(agent: HostAgent, options: { storage?: EventStorage } = {}): DrawPoolProvider {
  const storage = options.storage ?? browserEventStorage();
  return {
    async getEligibleMemberIds() {
      const sessionId = agent.connection.state.session?.id ?? null;
      const raw = sessionId ? storage.get(`${STORAGE_PREFIX}${sessionId}`) : null;
      let event: PortalEvent | null = null;
      try {
        event = raw ? readPortalEvent({ [PORTAL_EVENT_NS]: JSON.parse(raw) }) : null;
      } catch {
        event = null;
      }
      if (!sessionId || !event || event.pool !== "entrants") return null;
      // エントリー受付を始めていないなら、対象は空（抽選側が「対象のメンバーがいません」と知らせる）
      if (!event.entry) return [];
      try {
        return await fetchEntrantIds(agent, storage, sessionId, event.entry.key);
      } catch (error) {
        const saved = loadEntrantSnapshot(storage, sessionId, event.entry.key);
        if (saved) return saved;
        console.error("エントリー者の一覧を取得できませんでした", error);
        throw new Error("エントリーした人の一覧を取得できませんでした。通信状況を確認して、もう一度お試しください。");
      }
    },
  };
}
