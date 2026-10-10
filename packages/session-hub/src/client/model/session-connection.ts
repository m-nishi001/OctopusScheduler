/**
 * 1端末ぶんのセッション接続。入室・リロード復帰・更新の購読・コマンド発行・状態公開を担う。
 *
 * フレームワーク非依存(Vue からは use-session-connection.ts で購読する)。
 * 更新の受け取り方は SessionTransport に任せるので、ポーリングでも WebSocket でも同じ。
 *
 * 保証:
 *   - ホストのコマンド適用は seq 順・1回だけ(リロードしても二重適用しない。適用済み seq を永続化)
 *   - 古すぎるコマンド(maxCommandAgeMs 超)はホストでは適用せず破棄する(リロード中に溜まった操作の暴走防止)
 *   - コマンド発行は通信失敗時に同じ requestId で再送する(サーバ側で重複排除される)
 *   - 状態公開は最新のものだけ送る(連続更新を間引く)
 */
import type { SessionHubApi } from "../../server/session-hub-api-contract";
import { parseHubErrorCode } from "../../server/engine/hub-error";
import type { HubErrorCode } from "../../server/engine/hub-error";
import type {
  IssueCommandResult,
  JoinClientArgs,
  JoinOperatorArgs,
  JoinResult,
  PollArgs,
  PollResult,
} from "../../shared/protocol";
import type {
  Command,
  DeviceRole,
  PresenceView,
  RoomState,
  SessionInfo,
} from "../../shared/session-types";
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
} from "./device-store";
import type { DeviceStore, StoredCredentials } from "./device-store";
import type { SessionTransport, TransportSource } from "./transport";

export type ConnectionPhase =
  | "idle"
  | "joining"
  | "connected"
  /** 通信失敗が続いている(再試行中)。 */
  | "reconnecting"
  /** セッションが終了/期限切れ/存在しない。 */
  | "ended"
  /** 端末の認証が無効(入室し直しが必要)。 */
  | "unauthorized";

export interface ConnectionState {
  phase: ConnectionPhase;
  role: DeviceRole | null;
  session: SessionInfo | null;
  deviceId: string | null;
  /** 参加者の参加コード。端末認証が切れたときに同じコードで入り直すために保持する。 */
  code: string | null;
  roomState: RoomState | null;
  presence: PresenceView | null;
  headSeq: number;
  /** 管理端末のコンソール表示用の直近コマンド(新しいものが後ろ)。 */
  recentCommands: Command[];
  failureCount: number;
  lastError: string | null;
  lastErrorCode: HubErrorCode | null;
  /** サーバ時刻 - 端末時刻(ms)。締切の表示を端末時計のずれに依存させないために使う。 */
  serverOffsetMs: number;
  /** 古すぎて適用しなかったコマンドの累計(ホスト)。 */
  skippedCommands: number;
}

export interface ConnectionOptions {
  api: SessionHubApi;
  store: DeviceStore;
  transport: SessionTransport;
  now?: () => number;
  newRequestId?: () => string;
  /** ホストで、これより古いコマンドは適用しない。 */
  maxCommandAgeMs?: number;
  /** issue の通信失敗時の再送回数。 */
  issueRetries?: number;
  issueRetryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const RECENT_COMMANDS_LIMIT = 30;
const FATAL_CODES: ReadonlySet<HubErrorCode> = new Set(["SESSION_CLOSED", "SESSION_NOT_FOUND", "DEVICE_UNAUTHORIZED"]);

const defaultRequestId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;

function errorInfo(error: unknown): { message: string; code: HubErrorCode | null } {
  const message = error instanceof Error ? error.message : String(error);
  return { message, code: parseHubErrorCode(message) };
}

export class SessionConnection implements TransportSource {
  private current: ConnectionState = {
    phase: "idle",
    role: null,
    session: null,
    deviceId: null,
    code: null,
    roomState: null,
    presence: null,
    headSeq: 0,
    recentCommands: [],
    failureCount: 0,
    lastError: null,
    lastErrorCode: null,
    serverOffsetMs: 0,
    skippedCommands: 0,
  };
  private listeners = new Set<(state: ConnectionState) => void>();
  private commandHandler: ((command: Command) => void | Promise<void>) | null = null;

  private readonly pendingDeviceIds = new Map<string, string>();
  private creds: StoredCredentials | null = null;
  private sinceSeq = 0;
  private stateVersion = 0;

  private publishing = false;
  private pendingPublish: { data: Record<string, unknown>; clientInput: string[] } | null = null;
  private publishWaiters: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

  private readonly now: () => number;
  private readonly newRequestId: () => string;
  private readonly maxCommandAgeMs: number;
  private readonly issueRetries: number;
  private readonly issueRetryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: ConnectionOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.newRequestId = opts.newRequestId ?? defaultRequestId;
    this.maxCommandAgeMs = opts.maxCommandAgeMs ?? 30_000;
    this.issueRetries = opts.issueRetries ?? 2;
    this.issueRetryDelayMs = opts.issueRetryDelayMs ?? 500;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get state(): ConnectionState {
    return this.current;
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** ホスト端末: コマンドの適用処理を登録する。seq 順に1件ずつ、完了を待って呼ばれる。 */
  onCommand(handler: (command: Command) => void | Promise<void>): void {
    this.commandHandler = handler;
  }

  private set(patch: Partial<ConnectionState>): void {
    this.current = { ...this.current, ...patch };
    for (const l of [...this.listeners]) l(this.current);
  }

  // ---- 入室 ----

  async joinOperator(args: Omit<JoinOperatorArgs, "deviceId">): Promise<JoinResult> {
    this.set({ phase: "joining", lastError: null, lastErrorCode: null });
    const stored = loadCredentials(this.opts.store, args.role);
    // 端末IDは自分で採番して送る。入室の応答が失われて再送しても、サーバは同じ端末として扱う。
    // 失敗した入室の再試行でも同じIDを使い続けるため、成功するまでインスタンス内に保持する。
    const pendingKey = `${args.sessionId}:${args.role}`;
    const deviceId =
      stored && stored.sessionId === args.sessionId
        ? stored.deviceId
        : this.pendingDeviceIds.get(pendingKey) ?? this.newRequestId();
    this.pendingDeviceIds.set(pendingKey, deviceId);
    try {
      const result = await this.opts.api.joinOperator({ ...args, deviceId });
      this.pendingDeviceIds.delete(pendingKey);
      this.adopt(result, args.label, undefined, stored?.sessionId === args.sessionId && stored.deviceId === result.deviceId ? stored.appliedSeq : undefined);
      return result;
    } catch (error) {
      this.failJoin(error);
      throw error;
    }
  }

  async joinClient(args: Omit<JoinClientArgs, "deviceId" | "token">): Promise<JoinResult> {
    this.set({ phase: "joining", lastError: null, lastErrorCode: null });
    const stored = loadCredentials(this.opts.store, "client");
    const sameCode = stored?.code && stored.code.toUpperCase() === args.code.trim().toUpperCase();
    try {
      const result = await this.opts.api.joinClient({
        ...args,
        deviceId: sameCode ? stored?.deviceId : undefined,
        token: sameCode ? stored?.token : undefined,
      });
      this.adopt(result, args.label ?? "", args.code.trim().toUpperCase());
      return result;
    } catch (error) {
      this.failJoin(error);
      throw error;
    }
  }

  /**
   * 保存済みの入室情報から復帰する(リロード後)。最初の取得で認証を確かめ、
   * 無効なら 'unauthorized' になる。復帰できる情報が無ければ false。
   */
  resume(role: DeviceRole): boolean {
    const stored = loadCredentials(this.opts.store, role);
    if (!stored) return false;
    this.creds = stored;
    this.sinceSeq = stored.appliedSeq;
    this.stateVersion = 0;
    this.set({
      phase: "joining",
      role: stored.role,
      deviceId: stored.deviceId,
      code: stored.code ?? null,
      headSeq: 0,
      lastError: null,
      lastErrorCode: null,
    });
    this.opts.transport.start(this);
    return true;
  }

  private adopt(result: JoinResult, label: string, code?: string, storedAppliedSeq?: number): void {
    const role = result.role;
    // ホストが新規入室したときは、過去のコマンドを再生しない(現在の head から始める)。
    // リロード復帰で適用済み seq が残っている場合はそこから続ける。
    const startSeq = role === "host" ? storedAppliedSeq ?? result.head.seq : result.head.seq;
    this.creds = {
      sessionId: result.session.id,
      deviceId: result.deviceId,
      token: result.token,
      role,
      label,
      code,
      appliedSeq: startSeq,
    };
    saveCredentials(this.opts.store, this.creds);
    this.sinceSeq = startSeq;
    this.stateVersion = 0;
    this.set({
      phase: "connected",
      role,
      session: result.session,
      deviceId: result.deviceId,
      code: code ?? null,
      headSeq: result.head.seq,
      roomState: null,
      presence: null,
      recentCommands: [],
      failureCount: 0,
      lastError: null,
      lastErrorCode: null,
    });
    this.opts.transport.start(this);
  }

  private failJoin(error: unknown): void {
    const { message, code } = errorInfo(error);
    this.set({ phase: "idle", lastError: message, lastErrorCode: code });
  }

  /** 退室する。保存済みの入室情報も消す(次回は新規入室になる)。 */
  leave(): void {
    this.opts.transport.stop();
    if (this.creds) clearCredentials(this.opts.store, this.creds.role);
    this.creds = null;
    this.set({ phase: "idle", role: null, session: null, deviceId: null, code: null, roomState: null, presence: null });
  }

  /** 画面を閉じるとき。入室情報は残す(リロード復帰のため)。 */
  dispose(): void {
    this.opts.transport.stop();
    this.listeners.clear();
  }

  setVisible(visible: boolean): void {
    this.opts.transport.setVisible(visible);
  }

  // ---- TransportSource ----

  buildPollArgs(): PollArgs {
    const c = this.creds;
    if (!c) throw new Error("not joined");
    return {
      sessionId: c.sessionId,
      deviceId: c.deviceId,
      token: c.token,
      sinceSeq: this.sinceSeq,
      stateVersion: this.stateVersion,
      ackSeq: c.role === "host" ? this.sinceSeq : undefined,
    };
  }

  async onUpdate(result: PollResult): Promise<void> {
    const c = this.creds;
    if (!c) return;
    const localNow = this.now();
    const serverOffsetMs = result.serverTimeMs - localNow;

    let skipped = this.current.skippedCommands;
    if (result.resync) {
      // 取りこぼし: 溜まっていた分は適用せず、現在の head と状態に追従する。
      this.sinceSeq = result.head.seq;
    } else if (c.role === "host") {
      for (const cmd of [...result.commands].sort((a, b) => a.seq - b.seq)) {
        if (cmd.seq <= this.sinceSeq) continue;
        const age = result.serverTimeMs - cmd.atMs;
        if (age > this.maxCommandAgeMs) {
          skipped++;
        } else if (this.commandHandler) {
          try {
            await this.commandHandler(cmd);
          } catch {
            // 適用に失敗しても同じコマンドを繰り返さない(二重実行より取りこぼしを選ぶ)
          }
        }
        this.sinceSeq = cmd.seq;
        this.persistApplied();
      }
    } else {
      for (const cmd of result.commands) if (cmd.seq > this.sinceSeq) this.sinceSeq = cmd.seq;
    }
    if (c.role === "client") this.sinceSeq = result.head.seq;

    let recent = this.current.recentCommands;
    if (result.commands.length > 0 && c.role === "admin") {
      const known = new Set(recent.map((r) => r.seq));
      recent = [...recent, ...result.commands.filter((x) => !known.has(x.seq))].slice(-RECENT_COMMANDS_LIMIT);
    }

    if (result.state) this.stateVersion = result.state.version;
    this.persistApplied();

    this.set({
      phase: result.session.status === "closed" ? "ended" : "connected",
      session: result.session,
      headSeq: result.head.seq,
      roomState: result.state ?? this.current.roomState,
      presence: result.presence,
      recentCommands: recent,
      failureCount: 0,
      lastError: null,
      lastErrorCode: null,
      serverOffsetMs,
      skippedCommands: skipped,
    });
    if (result.session.status === "closed") this.opts.transport.stop();
    await this.flushPendingPublish();
  }

  onError(error: unknown, consecutiveFailures: number): "retry" | "stop" {
    const { message, code } = errorInfo(error);
    if (code && FATAL_CODES.has(code)) {
      this.set({
        phase: code === "DEVICE_UNAUTHORIZED" ? "unauthorized" : "ended",
        lastError: message,
        lastErrorCode: code,
        failureCount: consecutiveFailures,
      });
      // 無効になった入室情報は残さない(次回は新規入室になる)。
      if (this.creds) clearCredentials(this.opts.store, this.creds.role);
      // 公開待ちの呼び出しが宙に浮かないよう失敗させる。
      this.rejectPublishWaiters(error);
      return "stop";
    }
    this.set({
      phase: consecutiveFailures >= 2 ? "reconnecting" : this.current.phase,
      lastError: message,
      lastErrorCode: code,
      failureCount: consecutiveFailures,
    });
    return "retry";
  }

  private rejectPublishWaiters(error: unknown): void {
    const waiters = this.publishWaiters;
    this.publishWaiters = [];
    this.pendingPublish = null;
    for (const w of waiters) w.reject(error);
  }

  private persistApplied(): void {
    if (!this.creds || this.creds.role !== "host") return;
    if (this.creds.appliedSeq === this.sinceSeq) return;
    this.creds = { ...this.creds, appliedSeq: this.sinceSeq };
    saveCredentials(this.opts.store, this.creds);
  }

  // ---- 操作 ----

  /** コマンドを発行する(管理端末、または許可された参加者入力)。通信失敗は同じ requestId で再送する。 */
  async issue(game: string, type: string, payload?: unknown): Promise<IssueCommandResult> {
    const c = this.creds;
    if (!c) throw new Error("not joined");
    const requestId = this.newRequestId();
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const result = await this.opts.api.issueCommand({
          sessionId: c.sessionId,
          deviceId: c.deviceId,
          token: c.token,
          requestId,
          game,
          type,
          payload,
        });
        this.opts.transport.kick();
        return result;
      } catch (error) {
        const { code } = errorInfo(error);
        // 業務エラー(権限なし等)は再送しても変わらない。通信失敗だけ再送する。
        if (code || attempt >= this.issueRetries) throw error;
        attempt++;
        await this.sleep(this.issueRetryDelayMs * attempt);
      }
    }
  }

  /** ホスト: 現在の状態を公開する。連続して呼ばれたら最新のものだけ送る。 */
  publish(data: Record<string, unknown>, clientInput: string[] = []): Promise<void> {
    if (!this.creds) return Promise.reject(new Error("not joined"));
    return new Promise<void>((resolve, reject) => {
      this.pendingPublish = { data, clientInput };
      this.publishWaiters.push({ resolve, reject });
      void this.flushPendingPublish();
    });
  }

  /**
   * 保留中の公開を送る。成功したら待っていた呼び出しを解決し、その間に新しい公開が
   * 溜まっていれば続けて送る。通信失敗なら保留に戻し、次の更新取得の成功時に再送する
   * (ここで即再試行すると障害中に無限ループになるため)。
   */
  private async flushPendingPublish(): Promise<void> {
    if (this.publishing || !this.pendingPublish || !this.creds) return;
    this.publishing = true;
    const job = this.pendingPublish;
    this.pendingPublish = null;
    const waiters = this.publishWaiters;
    this.publishWaiters = [];
    const c = this.creds;
    let published = false;
    try {
      const { version } = await this.opts.api.publishState({
        sessionId: c.sessionId,
        deviceId: c.deviceId,
        token: c.token,
        data: job.data,
        clientInput: job.clientInput,
      });
      // 自分が公開した版は取り直さなくてよい。
      this.stateVersion = Math.max(this.stateVersion, version);
      this.set({
        roomState: { version, data: job.data, clientInput: job.clientInput, updatedAtMs: this.now() + this.current.serverOffsetMs },
      });
      for (const w of waiters) w.resolve();
      published = true;
    } catch (error) {
      if (errorInfo(error).code) {
        for (const w of waiters) w.reject(error);
      } else {
        this.pendingPublish = this.pendingPublish ?? job;
        this.publishWaiters = [...waiters, ...this.publishWaiters];
      }
    } finally {
      this.publishing = false;
    }
    if (published && this.pendingPublish) await this.flushPendingPublish();
  }
}
