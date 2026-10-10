/**
 * WebSocket(Cloudflare の Durable Object)上のメッセージ。
 *
 * 課金の考え方(Cloudflare 無料枠): サーバ→クライアントの送信は課金されず、
 * クライアント→サーバのメッセージは 20 件で 1 リクエスト換算。そのため
 *   - 更新はすべて server push(`update`)にし、クライアントはポーリングしない
 *   - 生存確認の ping/pong は auto-response(DOを起こさず課金もされない)
 *   - クライアントから送るのは入室時の `auth` と、ホストの適用報告 `ack` だけ
 * にする。コマンド発行・状態公開は(再送制御のある)RPC を使う。
 */
import type { HubErrorCode } from "../server/engine/hub-error";
import type { PollResult } from "./protocol";

export type ClientWsMessage =
  | {
      t: "auth";
      sessionId: string;
      deviceId: string;
      token: string;
      /** 手元で受信/適用済みの最後の seq と RoomState の version(再接続時の差分取得用)。 */
      sinceSeq: number;
      stateVersion: number;
    }
  | { t: "ack"; seq: number }
  /**
   * コマンド発行。接続済みの端末なら RPC ではなくこちらで送る(20件=1リクエスト換算で、
   * 参加者数百人の一斉入力でも無料枠に収まる)。応答は `issued` / `rejected`。
   */
  | { t: "issue"; requestId: string; game: string; type: string; payload?: unknown }
  /** 回答ラウンドへの回答(参加者)。応答は `answered` / `rejected`。 */
  | { t: "answer"; requestId: string; key: string; no: number };

export type ServerWsMessage =
  | { t: "update"; result: PollResult }
  | { t: "error"; code: HubErrorCode | null; message: string }
  | { t: "issued"; requestId: string; seq: number; duplicate: boolean }
  | { t: "answered"; requestId: string; no: number; atMs: number; duplicate: boolean }
  | { t: "rejected"; requestId: string; code: HubErrorCode | null; message: string };

/** 生存確認。サーバは auto-response で "pong" を返す(DOを起こさない)。 */
export const WS_PING = "ping";
export const WS_PONG = "pong";
/** クライアントが ping を送る間隔。無通信の接続が中間装置に切られるのを防ぐ。 */
export const WS_PING_INTERVAL_MS = 25_000;
/** pong が返らなければ接続を失ったとみなして再接続する。 */
export const WS_PONG_TIMEOUT_MS = 10_000;

/** 認証失敗/セッション終了でサーバが閉じるときのクローズコード(再接続しない)。 */
export const WS_CLOSE_UNAUTHORIZED = 4401;
export const WS_CLOSE_SESSION_ENDED = 4410;
/** サーバが同一端末の古い接続を新しい接続で置き換えるときのコード。 */
export const WS_CLOSE_REPLACED = 4409;
