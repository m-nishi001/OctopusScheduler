import { PORTAL_EVENT_END, PORTAL_EVENT_NS, PORTAL_EVENT_START, parseEventStartPayload, readPortalEvent } from "@octopus/session-hub";
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
 * ホストが `event` 名前空間のコマンドを受け、参加者ポータルに出すイベントを公開する。
 *   - `event.start { title }` : イベントを開始する(発生中のイベントがあれば置き換える)
 *   - `event.end`             : イベントを終了する
 * 発生中のイベントはセッションごとに端末へ保存し、ホストがリロード・再接続しても公開し直す。
 */
export function registerEventHost(agent: HostAgent, options: EventHostOptions = {}): () => void {
  const storage = options.storage ?? browserEventStorage();
  const now = options.now ?? (() => Date.now());
  const newId = options.newId ?? defaultNewId;
  const keyFor = (sessionId: string): string => `${STORAGE_PREFIX}${sessionId}`;
  const currentSessionId = (): string | null => agent.connection.state.session?.id ?? null;

  const unregister = agent.router.register(PORTAL_EVENT_NS, async (command) => {
    const sessionId = currentSessionId();
    if (command.type === PORTAL_EVENT_START) {
      const parsed = parseEventStartPayload(command.payload);
      if (!parsed) return;
      const event: PortalEvent = { id: newId(), title: parsed.title, startedAtMs: now() };
      if (sessionId) storage.set(keyFor(sessionId), JSON.stringify(event));
      await agent.publishSlice(PORTAL_EVENT_NS, event);
    } else if (command.type === PORTAL_EVENT_END) {
      if (sessionId) storage.remove(keyFor(sessionId));
      await agent.clearSlice(PORTAL_EVENT_NS);
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      storage.remove(keyFor(sessionId));
      return;
    }
    const event = readPortalEvent({ [PORTAL_EVENT_NS]: parsed });
    if (event) void agent.publishSlice(PORTAL_EVENT_NS, event);
    else storage.remove(keyFor(sessionId));
  });

  return () => {
    unregister();
    unsubscribe();
  };
}
