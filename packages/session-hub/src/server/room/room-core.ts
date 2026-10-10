/**
 * セッション1件ぶんの Durable Object が実行する中核ロジック(プラットフォーム非依存)。
 *
 * Durable Object は同一IDへの処理が直列に実行されるので、GAS/R2版で必要だったロックが不要になり、
 * コマンドの採番や `submitAnswer` 相当の排他が厳密に正しくなる。WebSocket でクライアントへ
 * 更新を push し、クライアントはポーリングしない(無料枠のリクエスト数を節約する)。
 *
 * ここは Cloudflare の型に依存しない。ストレージ・ソケット・時刻を `RoomContext` として受け取るので、
 * 単体テストでは偽物を渡して多数の端末を動かせる。実際の DO クラスは薄いアダプタ
 * (infrastructures/src/cloudflare/session-room.ts)。
 */
import { DomainError } from "@octopus/infrastructures/interfaces";
import type { PresenceEntry, SessionMeta, RoomState, Command, Device, DeviceRole } from "../../shared/session-types";
import type {
  IssueCommandArgs,
  JoinClientArgs,
  JoinOperatorArgs,
  PollArgs,
  PublishStateArgs,
} from "../../shared/protocol";
import {
  WS_CLOSE_REPLACED,
  WS_CLOSE_SESSION_ENDED,
  WS_CLOSE_UNAUTHORIZED,
} from "../../shared/ws-protocol";
import type { ClientWsMessage, ServerWsMessage } from "../../shared/ws-protocol";
import * as engine from "../engine/session-engine";
import { parseHubErrorCode } from "../engine/hub-error";
import type { PresenceStore, SessionRepo, StoredHead } from "../engine/session-repo";
import { COMMAND_RING_SIZE } from "../../shared/session-types";

export interface RoomStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  setAlarm(scheduledTimeMs: number): Promise<void>;
  getAlarm(): Promise<number | null>;
}

export interface SocketAttachment {
  deviceId: string;
  role: DeviceRole;
  label: string;
  /** サーバが最後に送った seq / state version(次の push の差分の基準)。 */
  sinceSeq: number;
  stateVersion: number;
  /** ホストが適用済みと報告した seq。 */
  ackSeq: number;
}

export interface RoomSocket {
  send(data: string): void;
  close(code: number, reason: string): void;
  getAttachment(): SocketAttachment | null;
  setAttachment(attachment: SocketAttachment | null): void;
}

export interface RoomContext {
  storage: RoomStorage;
  sockets(): RoomSocket[];
  now(): number;
  newId(): string;
  newToken(): string;
}

export type RoomOp =
  | "init"
  | "close"
  | "joinOperator"
  | "joinClient"
  | "poll"
  | "issueCommand"
  | "publishState";

export type RoomRpcResult = { ok: true; data: unknown } | { ok: false; message: string };

/** 在席の変化(入退室・ack)をまとめて配信する間隔。入室が殺到しても1回の push にまとめる。 */
export const PRESENCE_BROADCAST_DELAY_MS = 2000;

/** DO ストレージ上のセッション永続化(KV版と同じ形・同じキー粒度)。 */
export function createRoomRepo(storage: RoomStorage): SessionRepo {
  const slot = (seq: number): string => `cmd:${seq % COMMAND_RING_SIZE}`;
  return {
    getMeta: async () => (await storage.get<SessionMeta>("meta")) ?? null,
    putMeta: (meta) => storage.put("meta", meta),
    getHead: async () => (await storage.get<StoredHead>("head")) ?? null,
    putHead: (head) => storage.put("head", head),
    getState: async () => (await storage.get<RoomState>("state")) ?? null,
    putState: (state) => storage.put("state", state),
    getDevice: async (id) => (await storage.get<Device>(`dev:${id}`)) ?? null,
    putDevice: (device) => storage.put(`dev:${device.deviceId}`, device),
    getCommand: async (seq) => (await storage.get<Command>(slot(seq))) ?? null,
    putCommand: (command) => storage.put(slot(command.seq), command),
  };
}

export class SessionRoomCore {
  private readonly repo: SessionRepo;
  /** ポーリング(WebSocket を使えない端末)の在席。接続中ソケットの在席とは別に、メモリ上だけで持つ。 */
  private readonly pollTouches = new Map<string, PresenceEntry>();
  private presenceDirty = false;

  constructor(private readonly ctx: RoomContext) {
    this.repo = createRoomRepo(ctx.storage);
  }

  // ---- 在席 ----

  private presenceEntries(): PresenceEntry[] {
    const now = this.ctx.now();
    const byId = new Map<string, PresenceEntry>();
    for (const [id, e] of this.pollTouches) byId.set(id, e);
    for (const ws of this.ctx.sockets()) {
      const a = ws.getAttachment();
      if (!a) continue;
      // 接続中のソケットは「いま在席」。ack はソケット側の値を使う。
      byId.set(a.deviceId, { deviceId: a.deviceId, role: a.role, label: a.label, seenAtMs: now, ackSeq: a.ackSeq });
    }
    return [...byId.values()];
  }

  private readonly presence: PresenceStore = {
    touch: async (entry) => {
      this.pollTouches.set(entry.deviceId, entry);
      return this.presenceEntries();
    },
    list: async () => this.presenceEntries(),
  };

  private engineDeps(): engine.EngineDeps {
    return {
      repo: this.repo,
      presence: this.presence,
      now: this.ctx.now,
      newId: this.ctx.newId,
      newToken: this.ctx.newToken,
    };
  }

  // ---- RPC ----

  /** Worker からの RPC を実行する。業務エラー(DomainError)は ok:false で返し、想定外の例外はそのまま投げる。 */
  async handle(op: RoomOp, args: unknown, memberId?: string): Promise<RoomRpcResult> {
    try {
      return { ok: true, data: await this.run(op, args, memberId) };
    } catch (error) {
      if (error instanceof DomainError) return { ok: false, message: error.message };
      throw error;
    }
  }

  private async run(op: RoomOp, args: unknown, memberId?: string): Promise<unknown> {
    const deps = this.engineDeps();
    switch (op) {
      case "init": {
        const meta = (args as { meta: SessionMeta }).meta;
        if (!(await this.repo.getMeta())) await this.repo.putMeta(meta);
        return null;
      }
      case "close":
        await this.closeSession();
        return null;
      case "joinOperator": {
        const result = await engine.joinOperator(deps, args as JoinOperatorArgs, memberId ?? "");
        this.markPresenceDirty();
        return result;
      }
      case "joinClient": {
        const result = await engine.joinClient(deps, args as JoinClientArgs);
        this.markPresenceDirty();
        return result;
      }
      case "poll":
        return engine.poll(deps, args as PollArgs);
      case "issueCommand": {
        const result = await engine.issueCommand(deps, args as IssueCommandArgs);
        if (!result.duplicate) await this.broadcast();
        return result;
      }
      case "publishState": {
        const result = await engine.publishState(deps, args as PublishStateArgs);
        await this.broadcast();
        return result;
      }
      default:
        throw new DomainError(`unknown op: ${String(op)}`);
    }
  }

  private async closeSession(): Promise<void> {
    const meta = await this.repo.getMeta();
    if (!meta) return;
    if (meta.status !== "closed") await this.repo.putMeta({ ...meta, status: "closed" });
    await this.broadcast();
    for (const ws of this.ctx.sockets()) ws.close(WS_CLOSE_SESSION_ENDED, "session ended");
  }

  // ---- WebSocket ----

  async onMessage(ws: RoomSocket, raw: unknown): Promise<void> {
    if (typeof raw !== "string") return;
    let msg: ClientWsMessage;
    try {
      msg = JSON.parse(raw) as ClientWsMessage;
    } catch {
      return;
    }
    if (msg?.t === "auth") await this.onAuth(ws, msg);
    else if (msg?.t === "ack") await this.onAck(ws, msg.seq);
    else if (msg?.t === "issue") await this.onIssue(ws, msg);
  }

  /** WebSocket 経由のコマンド発行。接続時に認証済みの端末として、RPC と同じ検証(権限・許可入力・重複排除)を通す。 */
  private async onIssue(ws: RoomSocket, msg: Extract<ClientWsMessage, { t: "issue" }>): Promise<void> {
    const a = ws.getAttachment();
    const requestId = typeof msg.requestId === "string" ? msg.requestId : "";
    const reject = (error: unknown): void => {
      const message = error instanceof Error ? error.message : String(error);
      ws.send(JSON.stringify({ t: "rejected", requestId, code: parseHubErrorCode(message), message } satisfies ServerWsMessage));
    };
    if (!a) {
      reject(new DomainError("[DEVICE_UNAUTHORIZED] 先に認証してください"));
      return;
    }
    try {
      const meta = await this.repo.getMeta();
      const device = await this.repo.getDevice(a.deviceId);
      if (!meta || !device) throw new DomainError("[DEVICE_UNAUTHORIZED] 端末を認証できません");
      const result = await engine.issueCommand(this.engineDeps(), {
        sessionId: meta.id,
        deviceId: device.deviceId,
        token: device.token,
        requestId,
        game: msg.game,
        type: msg.type,
        payload: msg.payload,
      });
      ws.send(JSON.stringify({ t: "issued", requestId, seq: result.seq, duplicate: result.duplicate } satisfies ServerWsMessage));
      if (!result.duplicate) await this.broadcast();
    } catch (error) {
      if (error instanceof DomainError) reject(error);
      else throw error;
    }
  }

  private sendError(ws: RoomSocket, error: unknown, closeCode: number): void {
    const message = error instanceof Error ? error.message : String(error);
    const payload: ServerWsMessage = { t: "error", code: parseHubErrorCode(message), message };
    try {
      ws.send(JSON.stringify(payload));
    } finally {
      ws.close(closeCode, "rejected");
    }
  }

  private async onAuth(ws: RoomSocket, msg: Extract<ClientWsMessage, { t: "auth" }>): Promise<void> {
    let auth: { meta: SessionMeta; device: Device };
    try {
      auth = await engine.authenticate(
        { repo: this.repo, now: this.ctx.now },
        { sessionId: msg.sessionId, deviceId: msg.deviceId, token: msg.token }
      );
    } catch (error) {
      const code = parseHubErrorCode(error instanceof Error ? error.message : "");
      this.sendError(ws, error, code === "SESSION_CLOSED" || code === "SESSION_NOT_FOUND" ? WS_CLOSE_SESSION_ENDED : WS_CLOSE_UNAUTHORIZED);
      return;
    }
    if (auth.meta.id !== msg.sessionId) {
      this.sendError(ws, new DomainError("[DEVICE_UNAUTHORIZED] 端末を認証できません"), WS_CLOSE_UNAUTHORIZED);
      return;
    }

    // 同じ端末の古い接続(リロード直後の残り)は置き換える。
    for (const other of this.ctx.sockets()) {
      if (other !== ws && other.getAttachment()?.deviceId === auth.device.deviceId) {
        other.setAttachment(null);
        other.close(WS_CLOSE_REPLACED, "replaced");
      }
    }

    const attachment: SocketAttachment = {
      deviceId: auth.device.deviceId,
      role: auth.device.role,
      label: auth.device.label,
      sinceSeq: Math.max(0, msg.sinceSeq),
      stateVersion: Math.max(0, msg.stateVersion),
      ackSeq: auth.device.role === "host" ? Math.max(0, msg.sinceSeq) : 0,
    };
    ws.setAttachment(attachment);
    // 接続した端末の在席はソケットが正になる(入室 RPC で記録した在席は、切断後に残さない)。
    this.pollTouches.delete(attachment.deviceId);

    // 接続直後に、手元との差分を1回だけ返す(以後は変化があったときに push)。
    const head = (await this.repo.getHead()) ?? { seq: 0, stateVersion: 0, updatedAtMs: auth.meta.createdAtMs, recent: [] };
    const now = this.ctx.now();
    const result = await engine.buildUpdate(
      this.updateSource(auth.meta, head, now),
      attachment.role,
      attachment.sinceSeq,
      attachment.stateVersion
    );
    ws.send(JSON.stringify({ t: "update", result } satisfies ServerWsMessage));
    attachment.sinceSeq = head.seq;
    attachment.stateVersion = head.stateVersion;
    ws.setAttachment(attachment);
    this.markPresenceDirty();
  }

  private async onAck(ws: RoomSocket, seq: number): Promise<void> {
    const a = ws.getAttachment();
    if (!a || a.role !== "host" || !Number.isFinite(seq)) return;
    const head = await this.repo.getHead();
    const bounded = Math.min(Math.max(0, Math.floor(seq)), head?.seq ?? 0);
    if (bounded <= a.ackSeq) return;
    ws.setAttachment({ ...a, ackSeq: bounded });
    this.markPresenceDirty();
  }

  onClose(ws: RoomSocket): void {
    if (ws.getAttachment()) this.markPresenceDirty();
    ws.setAttachment(null);
  }

  // ---- 配信 ----

  private markPresenceDirty(): void {
    this.presenceDirty = true;
    void this.ctx.storage.getAlarm().then((at) => {
      if (at === null) return this.ctx.storage.setAlarm(this.ctx.now() + PRESENCE_BROADCAST_DELAY_MS);
      return undefined;
    });
  }

  /** DO の alarm から呼ぶ。在席の変化があれば全端末へ push する。 */
  async onAlarm(): Promise<void> {
    if (this.presenceDirty) await this.broadcast();
  }

  private updateSource(meta: SessionMeta, head: StoredHead, now: number): engine.UpdateSource {
    let statePromise: Promise<RoomState | null> | null = null;
    const commandCache = new Map<number, Promise<Command | null>>();
    return {
      meta,
      head,
      now,
      presence: engine.buildPresenceView(this.presenceEntries(), meta.hostDeviceId, now),
      getState: () => (statePromise ??= this.repo.getState()),
      getCommand: (seq) => {
        let p = commandCache.get(seq);
        if (!p) {
          p = this.repo.getCommand(seq);
          commandCache.set(seq, p);
        }
        return p;
      },
    };
  }

  /**
   * 接続中の全端末へ最新の更新を push する。同じ内容(役割グループ・差分の基準が同じ)は
   * 1 回だけ組み立てて文字列を使い回すので、参加者が数百人でも CPU は小さい。
   */
  async broadcast(): Promise<void> {
    this.presenceDirty = false;
    const meta = await this.repo.getMeta();
    if (!meta) return;
    const targets = this.ctx.sockets().filter((ws) => ws.getAttachment());
    if (targets.length === 0) return;
    const head = (await this.repo.getHead()) ?? { seq: 0, stateVersion: 0, updatedAtMs: meta.createdAtMs, recent: [] };
    const now = this.ctx.now();
    const src = this.updateSource(meta, head, now);

    const cache = new Map<string, string>();
    for (const ws of targets) {
      const a = ws.getAttachment();
      if (!a) continue;
      const key = a.role === "client" ? `c|${a.stateVersion}` : `o|${a.sinceSeq}|${a.stateVersion}`;
      let json = cache.get(key);
      if (json === undefined) {
        const result = await engine.buildUpdate(src, a.role, a.sinceSeq, a.stateVersion);
        json = JSON.stringify({ t: "update", result } satisfies ServerWsMessage);
        cache.set(key, json);
      }
      try {
        ws.send(json);
      } catch {
        // 切断済みのソケットは close イベントで片付く
        continue;
      }
      ws.setAttachment({ ...a, sinceSeq: head.seq, stateVersion: head.stateVersion });
    }
  }
}
