/**
 * SessionRoomCore(Durable Object の中核)のインメモリ実行環境。
 *
 * 実物の DO と同じく、RPC・WebSocket メッセージ・alarm は直列に処理する(入力ゲート相当)。
 * 無料枠の予算テストのため、課金に関わる操作(リクエスト・メッセージ・ストレージの読み書き)を数える。
 */
import { SessionRoomCore } from "../server/room/room-core";
import type { RoomOp, RoomRpcResult, RoomSocket, RoomStorage, SocketAttachment } from "../server/room/room-core";
import type { ClientWsMessage, ServerWsMessage } from "../shared/ws-protocol";
import type { SessionMeta } from "../shared/session-types";
import type { Clock } from "./test-hub";
import { FakeClock } from "./test-hub";

export interface RoomCounts {
  /** Worker 経由の RPC 回数(1回 = Worker 1 + DO 1 リクエスト)。 */
  rpc: number;
  /** WebSocket 接続の確立(1回 = Worker 1 + DO 1 リクエスト)。 */
  wsConnect: number;
  /** クライアント→サーバの WebSocket メッセージ(20件 = 1 リクエスト)。 */
  wsIncoming: number;
  /** サーバ→クライアントの送信(課金なし。参考値)。 */
  wsOutgoing: number;
  storageGet: number;
  storagePut: number;
  alarms: number;
}

export class FakeSocket implements RoomSocket {
  readonly received: ServerWsMessage[] = [];
  closed: { code: number; reason: string } | null = null;
  private attachment: SocketAttachment | null = null;
  /** クライアント側(ブリッジ)へ配送するためのフック。 */
  onServerSend: ((data: string) => void) | null = null;
  onServerClose: ((code: number, reason: string) => void) | null = null;

  constructor(private readonly onSend: () => void) {}

  send(data: string): void {
    if (this.closed) throw new Error("socket closed");
    this.onSend();
    this.received.push(JSON.parse(data) as ServerWsMessage);
    this.onServerSend?.(data);
  }
  close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = { code, reason };
    this.onServerClose?.(code, reason);
  }
  getAttachment(): SocketAttachment | null {
    return this.attachment ? { ...this.attachment } : null;
  }
  setAttachment(a: SocketAttachment | null): void {
    this.attachment = a ? { ...a } : null;
  }

  /** 受信した update のうち最新のもの。 */
  lastUpdate() {
    for (let i = this.received.length - 1; i >= 0; i--) {
      const m = this.received[i];
      if (m.t === "update") return m.result;
    }
    return null;
  }
  updates() {
    return this.received.flatMap((m) => (m.t === "update" ? [m.result] : []));
  }
  lastError() {
    for (let i = this.received.length - 1; i >= 0; i--) {
      const m = this.received[i];
      if (m.t === "error") return m;
    }
    return null;
  }
}

export class FakeRoom {
  readonly clock: Clock;
  readonly counts: RoomCounts = { rpc: 0, wsConnect: 0, wsIncoming: 0, wsOutgoing: 0, storageGet: 0, storagePut: 0, alarms: 0 };
  readonly store = new Map<string, unknown>();
  alarmAt: number | null = null;
  core: SessionRoomCore;
  /** テストからソケットを参照できるよう公開する。 */
  sockets: FakeSocket[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private idCounter = 0;

  constructor(clock: Clock = new FakeClock()) {
    this.clock = clock;
    this.core = this.newCore();
  }

  private newCore(): SessionRoomCore {
    const storage: RoomStorage = {
      get: async <T>(key: string) => {
        this.counts.storageGet++;
        return this.store.get(key) as T | undefined;
      },
      put: async (key, value) => {
        this.counts.storagePut++;
        this.store.set(key, structuredClone(value));
      },
      setAlarm: async (at) => {
        this.alarmAt = at;
      },
      getAlarm: async () => this.alarmAt,
    };
    return new SessionRoomCore({
      storage,
      sockets: () => this.sockets.filter((s) => !s.closed),
      now: this.clock.now,
      newId: () => `${(++this.idCounter).toString(16).padStart(8, "0")}-aaaa-bbbb-cccc-${(this.idCounter * 7919).toString(16).padStart(12, "0")}`,
      newToken: () => `tok-${(++this.idCounter).toString(16)}-${(this.idCounter * 104729).toString(16)}`,
    });
  }

  /** DO のハイバネート復帰を模す: メモリ上の状態(コア)は作り直し、ストレージとソケット(の attachment)は残る。 */
  hibernate(): void {
    this.core = this.newCore();
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  async init(meta: SessionMeta): Promise<void> {
    await this.call("init", { meta });
  }

  rpc(op: RoomOp, args: unknown, memberId?: string): Promise<RoomRpcResult> {
    this.counts.rpc++;
    return this.serial(() => this.core.handle(op, args, memberId));
  }

  /** RPC を実行し、成功なら data を、業務エラーなら例外(メッセージ付き)を返す。 */
  async call<T = unknown>(op: RoomOp, args: unknown, memberId?: string): Promise<T> {
    const res = await this.rpc(op, args, memberId);
    if (!res.ok) throw new Error(res.message);
    return res.data as T;
  }

  connect(): FakeSocket {
    this.counts.wsConnect++;
    const ws = new FakeSocket(() => {
      this.counts.wsOutgoing++;
    });
    this.sockets.push(ws);
    return ws;
  }

  send(ws: FakeSocket, message: ClientWsMessage | string): Promise<void> {
    this.counts.wsIncoming++;
    const raw = typeof message === "string" ? message : JSON.stringify(message);
    return this.serial(() => this.core.onMessage(ws, raw));
  }

  disconnect(ws: FakeSocket): Promise<void> {
    return this.serial(async () => {
      this.core.onClose(ws);
      ws.close(1000, "client closed");
    });
  }

  /** alarm が予約済みなら実行する。 */
  async runAlarm(): Promise<boolean> {
    if (this.alarmAt === null) return false;
    this.alarmAt = null;
    this.counts.alarms++;
    await this.serial(() => this.core.onAlarm());
    return true;
  }

  /** 接続してすぐ認証するショートカット。 */
  async connectAndAuth(creds: { sessionId: string; deviceId: string; token: string }, sinceSeq = 0, stateVersion = 0) {
    const ws = this.connect();
    await this.send(ws, { t: "auth", ...creds, sinceSeq, stateVersion });
    return ws;
  }

  /** 課金対象リクエスト数の見積もり(Workers + DO)。 */
  billableRequests(messagesPerRequest = 20): number {
    const c = this.counts;
    return c.rpc * 2 + c.wsConnect * 2 + Math.ceil(c.wsIncoming / messagesPerRequest);
  }
}
