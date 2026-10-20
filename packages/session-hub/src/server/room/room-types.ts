/** Durable Object の部屋(room-core / room-repo)が使う、プラットフォーム非依存の型。 */
import type { DeviceRole } from "../../shared/session-types";

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
  | "joinPortal"
  | "poll"
  | "issueCommand"
  | "publishState"
  | "openRound"
  | "closeRound"
  | "submitAnswer"
  | "getAnswers";

export type RoomRpcResult = { ok: true; data: unknown } | { ok: false; message: string };
