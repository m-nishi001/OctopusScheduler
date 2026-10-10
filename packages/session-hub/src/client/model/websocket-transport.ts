/**
 * WebSocket(Cloudflare の Durable Object)による SessionTransport。
 *
 * 更新はサーバからの push で届くのでポーリングしない。無料枠のため:
 *   - 画面が一定時間非表示なら切断し、表示に戻ったら再接続して差分を受け取る
 *   - 生存確認は軽量な "ping" 文字列(サーバは auto-response。DOを起こさず課金されない)
 *   - 再接続は指数バックオフ+ジッタ。1時間あたりの再接続回数に上限を設ける
 *   - WebSocket が使えない/繋がらない環境では、低頻度のポーリングに自動で切り替える(フォールバック)
 */
import type { IssueCommandResult, PollArgs } from "../../shared/protocol";
import {
  WS_PING,
  WS_PING_INTERVAL_MS,
  WS_PONG,
  WS_PONG_TIMEOUT_MS,
} from "../../shared/ws-protocol";
import type { ClientWsMessage, ServerWsMessage } from "../../shared/ws-protocol";
import { parseHubErrorCode } from "../../server/engine/hub-error";
import { realTimers } from "./polling-transport";
import type { Timers } from "./polling-transport";
import { TransportUnavailableError } from "./transport";
import type { IssueRequest, SessionTransport, TransportSource } from "./transport";

/** ブラウザの WebSocket と、テスト用の偽物の共通部分。 */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

const OPEN = 1;

export interface WebSocketOptions {
  /** セッションIDからWebSocketのURLを作る。 */
  url: (sessionId: string) => string;
  createSocket: (url: string) => WebSocketLike;
  /** WebSocket が使えないときに切り替えるポーリング(省略時はフォールバックなし)。 */
  fallback?: SessionTransport;
  backoffBaseMs: number;
  backoffMaxMs: number;
  jitterRatio: number;
  /** 非表示になってからこの時間が過ぎたら切断する。 */
  hiddenDisconnectMs: number;
  /** この窓(ms)内の再接続回数の上限。超えたらフォールバックへ。 */
  reconnectWindowMs: number;
  reconnectMaxPerWindow: number;
  /** 一度も更新を受け取れないまま接続に失敗した回数がこれに達したらフォールバックへ。 */
  maxInitialFailures: number;
  issueTimeoutMs: number;
}

export const DEFAULT_WS_OPTIONS: Omit<WebSocketOptions, "url" | "createSocket"> = {
  backoffBaseMs: 2000,
  backoffMaxMs: 30_000,
  jitterRatio: 0.2,
  hiddenDisconnectMs: 60_000,
  reconnectWindowMs: 60 * 60 * 1000,
  reconnectMaxPerWindow: 60,
  maxInitialFailures: 3,
  issueTimeoutMs: 8000,
};

interface PendingIssue {
  resolve: (r: IssueCommandResult) => void;
  reject: (e: unknown) => void;
  timer: unknown;
}

export class WebSocketTransport implements SessionTransport {
  private source: TransportSource | null = null;
  private running = false;
  private ws: WebSocketLike | null = null;
  private authed = false;
  private visible = true;
  private failures = 0;
  private everUpdated = false;
  private reconnectTimer: unknown = null;
  private pingTimer: unknown = null;
  private pongTimer: unknown = null;
  private hiddenTimer: unknown = null;
  private reconnectTimes: number[] = [];
  private usingFallback = false;
  private lastAckSent = 0;
  private readonly pending = new Map<string, PendingIssue>();

  constructor(
    private readonly options: WebSocketOptions,
    private readonly timers: Timers = realTimers
  ) {}

  /** テスト用: WebSocket ではなくフォールバック(ポーリング)で動いているか。 */
  get isUsingFallback(): boolean {
    return this.usingFallback;
  }

  start(source: TransportSource): void {
    this.stop();
    this.source = source;
    this.running = true;
    this.failures = 0;
    this.everUpdated = false;
    this.usingFallback = false;
    this.lastAckSent = 0;
    this.connect();
  }

  stop(): void {
    this.running = false;
    this.source = null;
    this.clearTimers();
    this.closeSocket(1000, "client stop");
    this.failPending(new TransportUnavailableError("stopped"));
    this.options.fallback?.stop();
    this.usingFallback = false;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.usingFallback) {
      this.options.fallback?.setVisible(visible);
      return;
    }
    if (!this.running) return;
    if (!visible) {
      if (this.hiddenTimer === null) {
        this.hiddenTimer = this.timers.setTimeout(() => {
          this.hiddenTimer = null;
          // 長く非表示だった: 接続を手放す(再表示で差分つきで再接続)
          this.clearConnectionTimers();
          this.closeSocket(1000, "hidden");
        }, this.options.hiddenDisconnectMs);
      }
      return;
    }
    if (this.hiddenTimer !== null) {
      this.timers.clearTimeout(this.hiddenTimer);
      this.hiddenTimer = null;
    }
    if (!this.ws) {
      this.clearReconnectTimer();
      this.connect();
    }
  }

  kick(): void {
    // WebSocket は push なので、取得を急ぐ必要はない。切断中なら今すぐ再接続する。
    if (this.usingFallback) {
      this.options.fallback?.kick();
      return;
    }
    if (this.running && !this.ws) {
      this.clearReconnectTimer();
      this.connect();
    }
  }

  issue(request: IssueRequest): Promise<IssueCommandResult> | null {
    if (this.usingFallback || !this.ws || this.ws.readyState !== OPEN || !this.authed) return null;
    return new Promise<IssueCommandResult>((resolve, reject) => {
      const timer = this.timers.setTimeout(() => {
        this.pending.delete(request.requestId);
        reject(new TransportUnavailableError("issue timed out"));
      }, this.options.issueTimeoutMs);
      this.pending.set(request.requestId, { resolve, reject, timer });
      this.sendMessage({ t: "issue", ...request });
    });
  }

  // ---- 接続 ----

  private jitter(ms: number): number {
    const spread = ms * this.options.jitterRatio;
    return Math.max(0, Math.round(ms + (this.timers.random() * 2 - 1) * spread));
  }

  private backoff(): number {
    return this.jitter(Math.min(this.options.backoffBaseMs * 2 ** Math.max(0, this.failures - 1), this.options.backoffMaxMs));
  }

  private connect(): void {
    const source = this.source;
    if (!this.running || !source || this.ws) return;

    // 再接続が多すぎる(接続が不安定/暴走)ならポーリングに切り替える。
    const cutoff = this.timers.now() - this.options.reconnectWindowMs;
    this.reconnectTimes = this.reconnectTimes.filter((t) => t >= cutoff);
    if (this.reconnectTimes.length >= this.options.reconnectMaxPerWindow) {
      this.switchToFallback();
      return;
    }
    this.reconnectTimes.push(this.timers.now());

    let args: PollArgs;
    try {
      args = source.buildPollArgs();
    } catch {
      return;
    }
    let socket: WebSocketLike;
    try {
      socket = this.options.createSocket(this.options.url(args.sessionId));
    } catch {
      this.onConnectionLost(new TransportUnavailableError("cannot create socket"));
      return;
    }
    this.ws = socket;
    this.authed = false;

    socket.onopen = () => {
      if (this.ws !== socket) return;
      const a = source.buildPollArgs();
      this.sendMessage({
        t: "auth",
        sessionId: a.sessionId,
        deviceId: a.deviceId,
        token: a.token,
        sinceSeq: a.sinceSeq,
        stateVersion: a.stateVersion,
      });
      this.startPing();
    };
    socket.onmessage = (ev) => {
      if (this.ws !== socket) return;
      this.onMessage(ev.data);
    };
    socket.onerror = () => {
      // close イベントで処理する
    };
    socket.onclose = (ev) => {
      if (this.ws !== socket) return;
      this.ws = null;
      this.authed = false;
      this.clearConnectionTimers();
      this.failPending(new TransportUnavailableError("socket closed"));
      if (ev.code === 4401 || ev.code === 4410) {
        // サーバが拒否/終了で閉じた。理由の error メッセージが届いていなければここで通知する(再接続しない)。
        const source2 = this.source;
        if (this.running && source2) {
          const fatal = ev.code === 4401 ? "[DEVICE_UNAUTHORIZED] 端末を認証できません" : "[SESSION_CLOSED] セッションは終了しています";
          if (source2.onError(new Error(fatal), this.failures + 1) === "stop") this.running = false;
        }
        return;
      }
      if (ev.code === 4409) return; // 同じ端末の新しい接続に置き換えられた
      if (this.running) this.onConnectionLost(new TransportUnavailableError(`socket closed (${ev.code})`));
    };
  }

  private onConnectionLost(error: unknown): void {
    const source = this.source;
    if (!this.running || !source) return;
    this.failures++;
    if (!this.everUpdated && this.failures >= this.options.maxInitialFailures) {
      this.switchToFallback();
      return;
    }
    if (source.onError(error, this.failures) === "stop") {
      this.running = false;
      return;
    }
    if (!this.visible) return; // 非表示の間は再接続しない。表示に戻ったら接続する
    this.clearReconnectTimer();
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff());
  }

  private switchToFallback(): void {
    const fallback = this.options.fallback;
    const source = this.source;
    this.clearTimers();
    this.closeSocket(1000, "fallback");
    if (!fallback || !source) {
      // フォールバックが無ければ、低頻度で再接続を続ける(暴走させない)
      if (this.running) {
        this.reconnectTimer = this.timers.setTimeout(() => {
          this.reconnectTimer = null;
          this.reconnectTimes = [];
          this.connect();
        }, this.options.backoffMaxMs);
      }
      return;
    }
    this.usingFallback = true;
    fallback.setVisible(this.visible);
    fallback.start(source);
  }

  // ---- メッセージ ----

  private sendMessage(message: ClientWsMessage): void {
    try {
      this.ws?.send(JSON.stringify(message));
    } catch {
      // 送信失敗は close イベントで再接続される
    }
  }

  private onMessage(data: unknown): void {
    if (typeof data !== "string") return;
    this.armPongWatch(false);
    if (data === WS_PONG) return;
    let msg: ServerWsMessage;
    try {
      msg = JSON.parse(data) as ServerWsMessage;
    } catch {
      return;
    }
    const source = this.source;
    if (!source) return;
    switch (msg.t) {
      case "update":
        this.authed = true;
        this.everUpdated = true;
        this.failures = 0;
        void Promise.resolve(source.onUpdate(msg.result)).then(
          () => this.maybeAck(source),
          () => undefined
        );
        break;
      case "issued": {
        const p = this.pending.get(msg.requestId);
        if (p) {
          this.timers.clearTimeout(p.timer);
          this.pending.delete(msg.requestId);
          p.resolve({ seq: msg.seq, duplicate: msg.duplicate });
        }
        break;
      }
      case "rejected": {
        const p = this.pending.get(msg.requestId);
        if (p) {
          this.timers.clearTimeout(p.timer);
          this.pending.delete(msg.requestId);
          p.reject(new Error(msg.message));
        }
        break;
      }
      case "error": {
        // 認証失敗・セッション終了など。fatal なら onError が 'stop' を返し、再接続しない。
        if (source.onError(new Error(msg.message), this.failures + 1) === "stop") {
          this.running = false;
          this.clearTimers();
          this.closeSocket(1000, "stopped");
        }
        break;
      }
    }
  }

  /** ホストが適用済みの seq が進んだら報告する(20件で1リクエスト換算の軽いメッセージ)。 */
  private maybeAck(source: TransportSource): void {
    try {
      const a = source.buildPollArgs();
      if (a.ackSeq !== undefined && a.ackSeq > this.lastAckSent) {
        this.lastAckSent = a.ackSeq;
        this.sendMessage({ t: "ack", seq: a.ackSeq });
      }
    } catch {
      // 未入室
    }
  }

  // ---- 生存確認 ----

  private startPing(): void {
    this.clearConnectionTimers();
    this.pingTimer = this.timers.setTimeout(() => this.ping(), WS_PING_INTERVAL_MS);
  }

  private ping(): void {
    if (!this.ws || this.ws.readyState !== OPEN) return;
    try {
      this.ws.send(WS_PING);
    } catch {
      return;
    }
    this.armPongWatch(true);
    this.pingTimer = this.timers.setTimeout(() => this.ping(), WS_PING_INTERVAL_MS);
  }

  private armPongWatch(arm: boolean): void {
    if (this.pongTimer !== null) {
      this.timers.clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    if (!arm) return;
    this.pongTimer = this.timers.setTimeout(() => {
      this.pongTimer = null;
      // 応答が無い: 接続が死んでいる。閉じて再接続する。
      const socket = this.ws;
      if (!socket) return;
      this.ws = null;
      this.authed = false;
      this.clearConnectionTimers();
      try {
        socket.close(4000, "pong timeout");
      } catch {
        // すでに閉じている
      }
      this.failPending(new TransportUnavailableError("pong timeout"));
      this.onConnectionLost(new TransportUnavailableError("pong timeout"));
    }, WS_PONG_TIMEOUT_MS);
  }

  // ---- 後始末 ----

  private clearConnectionTimers(): void {
    for (const key of ["pingTimer", "pongTimer"] as const) {
      if (this[key] !== null) this.timers.clearTimeout(this[key]);
      this[key] = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) this.timers.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearTimers(): void {
    this.clearConnectionTimers();
    this.clearReconnectTimer();
    if (this.hiddenTimer !== null) this.timers.clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
  }

  private closeSocket(code: number, reason: string): void {
    const socket = this.ws;
    this.ws = null;
    this.authed = false;
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try {
      socket.close(code, reason);
    } catch {
      // すでに閉じている
    }
  }

  private failPending(error: unknown): void {
    for (const [id, p] of this.pending) {
      this.timers.clearTimeout(p.timer);
      p.reject(error);
      this.pending.delete(id);
    }
  }
}
