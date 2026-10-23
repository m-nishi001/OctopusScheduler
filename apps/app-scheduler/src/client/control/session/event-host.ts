import {
  ENTRY_OPTIONS,
  PORTAL_EVENT_CLOSE_ENTRY,
  PORTAL_EVENT_END,
  PORTAL_EVENT_ENSURE_ENTRY,
  PORTAL_EVENT_NS,
  PORTAL_EVENT_OPEN_ENTRY,
  PORTAL_EVENT_SET_POOL,
  PORTAL_EVENT_START,
  entryRoundKey,
  parseEventStartPayload,
  parseHubErrorCode,
  parseSetPoolPayload,
  readPortalEvent,
} from "@octopus/session-hub";
import type { HostAgent, PortalEvent } from "@octopus/session-hub";
import type { DrawPoolProvider } from "@octopus/game-jackpot";
import { AccountsRepository } from "@octopus/accounts";
import { container } from "tsyringe";

/** ホストをリロードしても、発生中のイベントを参加者に出し続けるための保存先(セッションごと)。 */
export interface EventStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const STORAGE_PREFIX = "octopus.host.event:";
/** 抽選に使うエントリー者の一覧（直近に取得できたもの）。回答ラウンドが別の受付に置き換わっても抽選できるように残す。 */
const ENTRANTS_PREFIX = "octopus.host.entrants:";

/** ブラウザの localStorage を使う `EventStorage`。保存できない環境(プライベートモード等)でも例外を出さず、復元できないだけにする。 */
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
 *   - `event.ensureEntry`     : まだ受付を始めていないイベントだけ、受付を開始する(クイズのエントリー画面が自動で呼ぶ)
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

  /** エントリー受付を開く(締切後なら、エントリー済みの人を残したまま再開する)。 */
  const openEntry = async (sessionId: string | null, event: PortalEvent): Promise<void> => {
    const key = event.entry?.key ?? entryRoundKey(event.id);
    try {
      // 以前に受付を始めたイベントなら、エントリー済みの人を残したまま再開する
      await agent.connection.openEntryRound(key, [...ENTRY_OPTIONS], event.entry !== undefined);
    } catch (error) {
      console.error("エントリー受付を開始できませんでした", error);
      return;
    }
    // 抽選の対象（pool）は触らない。切り替えは運営の `event.setPool` だけで行う。
    await save(sessionId, { ...event, entry: { key, open: true } });
  };

  const unregister = agent.router.register(PORTAL_EVENT_NS, async (command) => {
    const sessionId = currentSessionId();
    const event = load(sessionId);

    if (command.type === PORTAL_EVENT_START) {
      const parsed = parseEventStartPayload(command.payload);
      if (!parsed) return;
      if (event?.entry?.open) await closeRoundQuietly(event.entry.key);
      if (sessionId) storage.remove(entrantsKey(sessionId));
      await save(sessionId, { id: newId(), title: parsed.title, startedAtMs: now(), pool: "auto" });
    } else if (command.type === PORTAL_EVENT_END) {
      if (event?.entry?.open) await closeRoundQuietly(event.entry.key);
      if (sessionId) {
        storage.remove(keyFor(sessionId));
        storage.remove(entrantsKey(sessionId));
      }
      await agent.clearSlice(PORTAL_EVENT_NS);
    } else if (command.type === PORTAL_EVENT_OPEN_ENTRY) {
      if (!event || event.entry?.open) return;
      await openEntry(sessionId, event);
    } else if (command.type === PORTAL_EVENT_ENSURE_ENTRY) {
      // 受付を始めたことがあるイベント(締切済み含む)は触らない。再開すると、別の回答受付に置き換わった一覧が空から始まるため
      if (!event || event.entry) return;
      await openEntry(sessionId, event);
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
  const memberIds = answers
    .filter((a) => a.memberId)
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

/** 管理者のメンバーIDの集合を取得する（管理者は抽選の対象にしない）。取得できなければ例外。 */
export type AdminIdsLoader = () => Promise<ReadonlySet<string>>;

const defaultAdminIdsLoader: AdminIdsLoader = async () => {
  const members = await container.resolve(AccountsRepository).listAccounts();
  return new Set(members.filter((m) => m.isAdmin).map((m) => m.id));
};

/**
 * ジャックポットの抽選の対象を、イベントの設定から決める。いずれも管理者は除く。
 *   - セッションの外（接続が無い）なら絞り込まない（null。リハーサル用）
 *   - 「参加者全員(自動)」（既定・指定なし・イベントなしを含む）: 抽選のたびに参加者名簿を取り直す
 *     （途中参加の人も対象になる）
 *   - 「エントリーした人だけ」: 受付の回答一覧（ログインから確定した人）から取得する。取得できなければ
 *     直近に保存した一覧を使い、それも無ければ例外にする
 * いずれも取得できないときは例外にする（全メンバーにフォールバックして、対象外の人が当選する事故を起こさない）。
 * 管理者の一覧は初めて必要になったときに取得し、このプロバイダが生きている間は保持する。
 */
export function createSessionDrawPool(agent: HostAgent, options: { storage?: EventStorage; loadAdminIds?: AdminIdsLoader } = {}): DrawPoolProvider {
  const storage = options.storage ?? browserEventStorage();
  const loadAdminIds = options.loadAdminIds ?? defaultAdminIdsLoader;
  let adminIds: Promise<ReadonlySet<string>> | null = null;
  const admins = (): Promise<ReadonlySet<string>> => {
    if (!adminIds) {
      const pending = loadAdminIds();
      adminIds = pending;
      // 失敗は保持しない（次の抽選で取り直す）
      pending.catch(() => {
        if (adminIds === pending) adminIds = null;
      });
    }
    return adminIds;
  };
  const withoutAdmins = async (ids: string[]): Promise<string[]> => {
    let set: ReadonlySet<string>;
    try {
      set = await admins();
    } catch (error) {
      console.error("管理者の一覧を取得できませんでした", error);
      throw new Error("管理者の一覧を取得できませんでした。通信状況を確認して、もう一度お試しください。");
    }
    return [...new Set(ids)].filter((id) => !set.has(id));
  };

  return {
    async getEligibleMemberIds() {
      const sessionId = agent.connection.state.session?.id ?? null;
      if (!sessionId) return null;
      const raw = storage.get(`${STORAGE_PREFIX}${sessionId}`);
      let event: PortalEvent | null = null;
      try {
        event = raw ? readPortalEvent({ [PORTAL_EVENT_NS]: JSON.parse(raw) }) : null;
      } catch {
        event = null;
      }
      if (!event || event.pool !== "entrants") {
        let memberIds: string[];
        try {
          memberIds = (await agent.listParticipants()).memberIds;
        } catch (error) {
          console.error("参加者の一覧を取得できませんでした", error);
          throw new Error("参加者の一覧を取得できませんでした。通信状況を確認して、もう一度お試しください。");
        }
        return withoutAdmins(memberIds);
      }
      // エントリー受付を始めていないなら、対象は空（抽選側が「対象のメンバーがいません」と知らせる）
      if (!event.entry) return [];
      let entrants: string[];
      try {
        entrants = await fetchEntrantIds(agent, storage, sessionId, event.entry.key);
      } catch (error) {
        const saved = loadEntrantSnapshot(storage, sessionId, event.entry.key);
        if (!saved) {
          console.error("エントリー者の一覧を取得できませんでした", error);
          throw new Error("エントリーした人の一覧を取得できませんでした。通信状況を確認して、もう一度お試しください。");
        }
        entrants = saved;
      }
      return withoutAdmins(entrants);
    },
  };
}
