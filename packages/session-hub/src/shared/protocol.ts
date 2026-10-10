/**
 * クライアント⇔サーバのやり取り(引数/応答)の型。transport(GASポーリング/WebSocket)に
 * 依らず同じ形を使う。
 */
import type {
  Command,
  DeviceRole,
  OperatorRole,
  PresenceView,
  RoomState,
  SessionInfo,
  SessionMeta,
  SessionMode,
  SessionSummary,
} from "./session-types";

export interface CreateSessionArgs {
  name: string;
  mode?: SessionMode;
}

export interface CloseSessionArgs {
  sessionId: string;
}

export interface JoinOperatorArgs {
  sessionId: string;
  role: OperatorRole;
  label: string;
  /** リロード復帰: 以前の deviceId を渡すと同じ端末として再接続する。 */
  deviceId?: string;
  /** host で、現在のホストが在席中でも引き継ぐ。 */
  takeover?: boolean;
}

export interface JoinClientArgs {
  code: string;
  memberId?: string;
  label?: string;
  /** リロード復帰用。deviceId と token の両方が一致したときだけ復帰する。 */
  deviceId?: string;
  token?: string;
}

export interface DeviceCredentials {
  sessionId: string;
  deviceId: string;
  token: string;
}

export interface JoinResult {
  session: SessionMeta;
  deviceId: string;
  token: string;
  role: DeviceRole;
  head: { seq: number; stateVersion: number };
}

export interface PollArgs extends DeviceCredentials {
  /** 受信済みの最後の seq。これより新しいコマンドを受け取る。 */
  sinceSeq: number;
  /** 手元の RoomState の version。違えば最新を返す。 */
  stateVersion: number;
  /** ホストが適用済みの最後の seq(ホストのみ)。 */
  ackSeq?: number;
}

export interface PollResult {
  /** 現在のセッション情報(リロード復帰直後の画面表示と、終了の検知に使う)。 */
  session: SessionInfo;
  serverTimeMs: number;
  head: { seq: number; stateVersion: number };
  commands: Command[];
  /** sinceSeq が古すぎてコマンドを取りこぼした。state を取り直して追従する。 */
  resync: boolean;
  /** stateVersion が手元と異なるときだけ入る。 */
  state: RoomState | null;
  presence: PresenceView;
  /** 次回までの待ち時間(ms)。サーバが負荷と活動量から指示する。 */
  nextPollMs: number;
}

export interface IssueCommandArgs extends DeviceCredentials {
  requestId: string;
  game: string;
  type: string;
  payload?: unknown;
}

export interface IssueCommandResult {
  seq: number;
  /** 同じ requestId の再送で、新規発行ではなく既存の seq を返した。 */
  duplicate: boolean;
}

export interface PublishStateArgs extends DeviceCredentials {
  data: Record<string, unknown>;
  clientInput?: string[];
}

export interface PublishStateResult {
  version: number;
}

export interface ListSessionsResult {
  sessions: SessionSummary[];
}
