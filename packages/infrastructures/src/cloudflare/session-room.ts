/**
 * セッション1件ぶんの Durable Object(Cloudflare 実行基盤での session-hub の中心)。
 *
 * 中核ロジックは session-hub の SessionRoomCore(プラットフォーム非依存・単体テスト済み)。
 * ここは Cloudflare の API(ストレージ・WebSocket Hibernation・alarm)へつなぐ薄いアダプタ。
 *
 * - Hibernation API(`ctx.acceptWebSocket`)を使うので、メッセージが無い間は DO がメモリから
 *   退避され、待機時間(duration)が課金されない。端末の情報はソケットの attachment に持つ。
 * - 生存確認の "ping" は auto-response で返し、DO を起こさない・課金されない。
 */
import { SessionRoomCore } from "@octopus/session-hub/room";
import type { RoomOp, RoomSocket, RoomStorage, SocketAttachment } from "@octopus/session-hub/room";
import { WS_PING, WS_PONG } from "@octopus/session-hub/shared";

export interface SessionRoomEnv {
  // 現状、DO 自身が参照するバインディングは無い(ストレージは ctx.storage)。
}

interface RpcBody {
  op: RoomOp;
  args: unknown;
  memberId?: string;
}

function newUuid(): string {
  return crypto.randomUUID();
}

export class SessionRoom {
  private readonly core: SessionRoomCore;

  constructor(
    private readonly ctx: DurableObjectState,
    _env: SessionRoomEnv
  ) {
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING, WS_PONG));
    const storage: RoomStorage = {
      get: <T>(key: string) => ctx.storage.get<T>(key),
      put: (key, value) => ctx.storage.put(key, value),
      setAlarm: (at) => ctx.storage.setAlarm(at),
      getAlarm: () => ctx.storage.getAlarm(),
    };
    this.core = new SessionRoomCore({
      storage,
      sockets: () => ctx.getWebSockets().map(toRoomSocket),
      now: () => Date.now(),
      newId: newUuid,
      newToken: () => `${newUuid()}${newUuid()}`.replace(/-/g, ""),
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      // 初期化されていない(存在しない)セッションにはソケットを張らせない。
      if (!(await this.ctx.storage.get("meta"))) return new Response("Session not found", { status: 404 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === "/rpc" && request.method === "POST") {
      const body = (await request.json()) as RpcBody;
      const result = await this.core.handle(body.op, body.args, body.memberId);
      return Response.json(result);
    }
    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.core.onMessage(toRoomSocket(ws), message);
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.core.onClose(toRoomSocket(ws));
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, "closed");
    } catch {
      // すでに閉じている
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.core.onClose(toRoomSocket(ws));
  }

  async alarm(): Promise<void> {
    await this.core.onAlarm();
  }
}

function toRoomSocket(ws: WebSocket): RoomSocket {
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    getAttachment: () => (ws.deserializeAttachment() as SocketAttachment | null) ?? null,
    setAttachment: (a) => ws.serializeAttachment(a),
  };
}
