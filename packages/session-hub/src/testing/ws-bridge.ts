/**
 * クライアントの WebSocketTransport と FakeRoom(Durable Object の中核)をつなぐ偽の WebSocket。
 * ネットワーク断・応答なし(ping に pong が返らない)・接続拒否を再現できる。
 */
import type { WebSocketLike } from "../client/model/websocket-transport";
import type { FakeRoom, FakeSocket } from "./fake-room";

export class BridgedWebSocket implements WebSocketLike {
  readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  readonly server: FakeSocket;
  readonly sent: string[] = [];

  constructor(private readonly bridge: WsBridge) {
    this.server = bridge.room.connect();
    this.server.onServerSend = (data) => this.deliver(() => this.onmessage?.({ data }));
    this.server.onServerClose = (code) => this.deliver(() => this.finish(code));
    queueMicrotask(() => {
      if (bridge.refuseConnections) {
        this.server.closed = { code: 1006, reason: "refused" };
        this.finish(1006);
        return;
      }
      this.readyState = 1;
      this.onopen?.({});
    });
  }

  private deliver(fn: () => void): void {
    if (this.bridge.blackhole) return;
    queueMicrotask(fn);
  }

  private finish(code: number): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code });
  }

  send(data: string): void {
    if (this.readyState !== 1) throw new Error("not open");
    this.sent.push(data);
    if (this.bridge.blackhole) return;
    if (data === "ping") {
      // サーバの auto-response(DOを起こさず課金もされない)
      if (!this.bridge.mutePong) this.deliver(() => this.onmessage?.({ data: "pong" }));
      return;
    }
    void this.bridge.room.send(this.server, data);
  }

  close(_code = 1000, _reason = ""): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    void this.bridge.room.disconnect(this.server);
  }

  /** ネットワークが落ちた: クライアントには close だけが届き、サーバ側のソケットも消える。 */
  drop(code = 1006): void {
    this.finish(code);
    void this.bridge.room.disconnect(this.server);
  }
}

export class WsBridge {
  refuseConnections = false;
  /** true の間、通信が一切届かない(切断の検知は ping/pong の失敗に任せる)。 */
  blackhole = false;
  mutePong = false;
  readonly sockets: BridgedWebSocket[] = [];

  constructor(readonly room: FakeRoom) {}

  createSocket = (_url: string): BridgedWebSocket => {
    const ws = new BridgedWebSocket(this);
    this.sockets.push(ws);
    return ws;
  };

  get live(): BridgedWebSocket[] {
    return this.sockets.filter((s) => s.readyState !== 3);
  }
}
