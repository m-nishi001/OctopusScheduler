/**
 * 「サーバの更新をどう受け取るか」の抽象。GAS/標準はポーリング、Cloudflare は WebSocket
 * (Durable Object)。SessionConnection はこのインターフェースだけを知る。
 */
import type { IssueCommandResult, PollArgs, PollResult } from "../../shared/protocol";

export interface TransportSource {
  /** 次の更新取得に使う引数(受信済み seq・state version・ack 等)。 */
  buildPollArgs(): PollArgs;
  /** 更新を受け取った。完了を待ってから次の取得を予約する(コマンド適用中に次を取らない)。 */
  onUpdate(result: PollResult): Promise<void> | void;
  /**
   * 取得に失敗した。'stop' を返すと再試行せず停止する(認証切れ・セッション終了など)。
   * 'retry' ならバックオフして再試行する。
   */
  onError(error: unknown, consecutiveFailures: number): "retry" | "stop";
}

export interface IssueRequest {
  requestId: string;
  game: string;
  type: string;
  payload?: unknown;
}

export interface SessionTransport {
  start(source: TransportSource): void;
  stop(): void;
  /** 画面の可視状態。非表示の間は取得間隔を延ばして無料枠を節約する。 */
  setVisible(visible: boolean): void;
  /** 次回の予約を待たず、すぐ取得する(操作直後の反映を速くする)。 */
  kick(): void;
  /**
   * 常時接続(WebSocket)がある場合の、コマンド発行の近道(RPC より安い)。
   * 接続中でなければ null を返し、呼び出し側は通常の RPC を使う。
   * 業務エラー(権限なし等)は例外にする。通信の失敗は NetworkIssue で表す。
   */
  issue?(request: IssueRequest): Promise<IssueCommandResult> | null;
}

/** transport 上の通信失敗(業務エラーではない)。呼び出し側は RPC へフォールバックして再送できる。 */
export class TransportUnavailableError extends Error {
  constructor(message = "transport unavailable") {
    super(message);
    this.name = "TransportUnavailableError";
  }
}
