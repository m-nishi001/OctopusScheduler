import { computed, inject, onScopeDispose, ref, watch } from "vue";
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from "vue";
import { parseHubErrorCode, readPortalEvent, useSessionConnection } from "@octopus/session-hub";
import type { ConnectionState, PortalEvent, SessionConnection, SubmitAnswerResult } from "@octopus/session-hub";
import { derivePortalStatus, statusMessage } from "./portal-status";
import type { JoinFailure, PortalStatus } from "./portal-status";

/**
 * 切断・終了・認証切れのあと、自動で入り直す回数の上限(連続で失敗している間)。
 * 無限に再試行してサーバーに負荷をかけない(無料枠の保護)。上限に達したら「つなぎ直す」ボタンに任せる。
 */
export const MAX_AUTO_REJOINS = 3;
/**
 * この時間以上つながり続けたら「安定した」とみなし、自動で入り直す回数を数え直す。
 * 入室できてもすぐ切れる状態(サーバーの不具合など)で、無限に入り直し続けないための条件。
 */
export const STABLE_CONNECTION_MS = 30_000;
/** 画面に戻ったときの再試行の最短間隔。 */
export const MIN_RETRY_INTERVAL_MS = 5_000;

export interface PortalSession {
  state: ShallowRef<ConnectionState>;
  status: ComputedRef<PortalStatus>;
  message: ComputedRef<string>;
  failure: Ref<JoinFailure | null>;
  /** いま発生中のイベント(無ければ null)。 */
  event: ComputedRef<PortalEvent | null>;
  /** 参加者数(在席)。 */
  clientCount: ComputedRef<number>;
  /** 回答ラウンドに回答する（エントリーなど）。先着で1人1回で、再送しても安全。 */
  answer(key: string, no: number): Promise<SubmitAnswerResult>;
  /** ホストが許可した操作を送る（例: ルーレットを止める）。通信失敗は同じ内容で安全に再送される。 */
  issue(game: string, type: string): Promise<unknown>;
  /** 入り直す(手動の「つなぎ直す」。回数制限なし)。 */
  join(): Promise<void>;
  /** 退室して、保存した入室情報を消す(ログアウト時)。 */
  leave(): void;
}

export const PORTAL_SESSION_KEY: InjectionKey<PortalSession> = Symbol("portalSession");

/** レイアウトが提供するポータルのセッションを取り出す。レイアウトの外で使うと例外にする。 */
export function usePortalContext(): PortalSession {
  const session = inject(PORTAL_SESSION_KEY, null);
  if (!session) throw new Error("PortalLayout の中で使ってください");
  return session;
}

function toFailure(error: unknown): JoinFailure {
  const raw = error instanceof Error ? error.message : String(error);
  const code = parseHubErrorCode(raw);
  if (code) return { code, message: raw.replace(/^\[[A-Z_]+\]\s*/, "") };
  if (/Unauthorized/i.test(raw)) return { code: null, message: "ログインが切れました。もう一度ログインしてください。" };
  return { code: null, message: "通信できませんでした。電波の良い場所で、もう一度お試しください。" };
}

export interface PortalSessionOptions {
  now?: () => number;
  /** 画面の表示/非表示の通知源。省略時はブラウザの visibilitychange。 */
  visibility?: { isVisible(): boolean; subscribe(listener: () => void): () => void };
}

/**
 * 参加者ポータルのセッション管理。ログイン済みのメンバーとして、公開中のセッションに
 * 参加コード無しで入り、イベントの発生などの公開状態を購読する。
 *
 * 更新は WebSocket の push(GAS はポーリング)で受け取り、ここからは定期的な問い合わせをしない。
 * 入り直すのは「切断・終了・認証切れのあと(回数上限あり)」「画面に戻ったとき(間隔制限あり)」
 * 「ユーザーが押したとき」だけ。
 */
export function usePortalSession(connection: SessionConnection, options: PortalSessionOptions = {}): PortalSession {
  const now = options.now ?? (() => Date.now());
  const { state } = useSessionConnection(connection);
  const joining = ref(false);
  const failure = ref<JoinFailure | null>(null);
  let autoRejoins = 0;
  let connectedAt: number | null = null;
  let lastAttemptAt = Number.NEGATIVE_INFINITY;

  async function join(): Promise<void> {
    if (joining.value) return;
    joining.value = true;
    lastAttemptAt = now();
    try {
      await connection.joinPortal();
      failure.value = null;
    } catch (error) {
      failure.value = toFailure(error);
    } finally {
      joining.value = false;
    }
  }

  const status = computed(() => derivePortalStatus({ phase: state.value.phase, joining: joining.value, failure: failure.value }));
  const message = computed(() => statusMessage(status.value, failure.value));
  const event = computed(() => readPortalEvent(state.value.roomState?.data));
  const clientCount = computed(() => state.value.presence?.clientCount ?? 0);

  // 切断・終了・認証切れで接続が止まったら、上限つきで自動で入り直す。
  // 回数を数え直すのは、STABLE_CONNECTION_MS 以上つながり続けたあとだけ(すぐ切れる状態では上限で止める)。
  const stopWatchPhase = watch(
    () => state.value.phase,
    (phase) => {
      if (phase === "connected") {
        connectedAt ??= now();
        return;
      }
      if (phase !== "ended" && phase !== "unauthorized") return;
      if (connectedAt !== null && now() - connectedAt >= STABLE_CONNECTION_MS) autoRejoins = 0;
      connectedAt = null;
      if (autoRejoins < MAX_AUTO_REJOINS) {
        autoRejoins++;
        void join();
      }
    }
  );

  // 画面に戻ったとき、つながっていなければ入り直す(前回の試行から一定時間以上あけて)。
  const visibility =
    options.visibility ??
    (typeof document === "undefined"
      ? null
      : {
          isVisible: () => document.visibilityState !== "hidden",
          subscribe: (listener: () => void) => {
            document.addEventListener("visibilitychange", listener);
            return () => document.removeEventListener("visibilitychange", listener);
          },
        });
  const stopVisibility = visibility?.subscribe(() => {
    if (!visibility.isVisible() || joining.value) return;
    if (status.value === "connected" || status.value === "reconnecting" || status.value === "joining") return;
    if (now() - lastAttemptAt < MIN_RETRY_INTERVAL_MS) return;
    void join();
  });

  onScopeDispose(() => {
    stopWatchPhase();
    stopVisibility?.();
  });

  return {
    state,
    status,
    message,
    failure,
    event,
    clientCount,
    answer: (key, no) => connection.answer(key, no),
    issue: (game, type) => connection.issue(game, type),
    join,
    leave: () => connection.leave(),
  };
}
