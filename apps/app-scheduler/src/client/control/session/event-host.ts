import {
  ENTRY_OPTIONS,
  PORTAL_EVENT_CLOSE_ENTRY,
  PORTAL_EVENT_END,
  PORTAL_EVENT_NS,
  PORTAL_EVENT_OPEN_ENTRY,
  PORTAL_EVENT_START,
  entryRoundKey,
  parseEventStartPayload,
  parseHubErrorCode,
  readPortalEvent,
} from "@octopus/session-hub";
import type { HostAgent, PortalEvent } from "@octopus/session-hub";

/** ホストをリロードしても、発生中のイベントを参加者に出し続けるための保存先(セッションごと)。 */
export interface EventStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const STORAGE_PREFIX = "octopus.host.event:";

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

  const unregister = agent.router.register(PORTAL_EVENT_NS, async (command) => {
    const sessionId = currentSessionId();
    const event = load(sessionId);

    if (command.type === PORTAL_EVENT_START) {
      const parsed = parseEventStartPayload(command.payload);
      if (!parsed) return;
      if (event?.entry?.open) await closeRoundQuietly(event.entry.key);
      await save(sessionId, { id: newId(), title: parsed.title, startedAtMs: now() });
    } else if (command.type === PORTAL_EVENT_END) {
      if (event?.entry?.open) await closeRoundQuietly(event.entry.key);
      if (sessionId) storage.remove(keyFor(sessionId));
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
      await save(sessionId, { ...event, entry: { key, open: true } });
    } else if (command.type === PORTAL_EVENT_CLOSE_ENTRY) {
      if (!event?.entry?.open) return;
      await closeRoundQuietly(event.entry.key);
      await save(sessionId, { ...event, entry: { ...event.entry, open: false } });
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
