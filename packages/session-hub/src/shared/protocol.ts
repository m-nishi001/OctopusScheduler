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
  /** 運営端末(ホスト/管理)にだけ入る、回答ラウンドの進行(回答数など)。参加者・ラウンド無しは null。 */
  round: RoundSummary | null;
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

// ---- 回答ラウンド(クイズ等の「全員が一斉に1回答える」受付。締切はサーバ時刻で強制する) ----

export interface RoundOption {
  /** 選択肢の番号(1以上の整数)。参加者はこの番号で回答する。 */
  no: number;
  text: string;
}

export interface OpenRoundArgs extends DeviceCredentials {
  /** ラウンドの識別子(例: "quizId:live")。結果の取得に使う。 */
  key: string;
  options: RoundOption[];
  durationMs: number;
}

export interface OpenRoundResult {
  key: string;
  /** 締切時刻(サーバ時刻 ms)。ホストはこれを公開し、参加者の画面が残り時間を表示する。 */
  deadlineMs: number;
  serverNowMs: number;
}

export interface CloseRoundArgs extends DeviceCredentials {
  key: string;
}

export interface SubmitAnswerArgs extends DeviceCredentials {
  key: string;
  no: number;
}

export interface SubmitAnswerResult {
  /** 実際に採用された回答の番号。2回目以降の送信は最初の回答のまま変えない。 */
  no: number;
  atMs: number;
  /** すでに回答済みで、今回の送信は採用されなかった。 */
  duplicate: boolean;
}

export interface GetAnswersArgs extends DeviceCredentials {
  key: string;
}

export interface RoundAnswer {
  deviceId: string;
  /** 参加者が選んだメンバー。ゲストは null。 */
  memberId: string | null;
  label: string;
  no: number;
  /** 回答を受け付けたサーバ時刻(ms)。 */
  atMs: number;
}

export interface RoundSummary {
  key: string;
  open: boolean;
  openedAtMs: number;
  deadlineMs: number;
  answerCount: number;
}

export interface GetAnswersResult {
  round: RoundSummary;
  answers: RoundAnswer[];
}

export interface ListSessionsResult {
  sessions: SessionSummary[];
}
