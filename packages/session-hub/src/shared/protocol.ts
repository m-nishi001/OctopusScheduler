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

export interface SetPortalSessionArgs {
  sessionId: string;
  /** true で参加者ポータルの入口にする(他のセッションの公開は外れる)。false で公開を止める。 */
  published: boolean;
}

/** クイズ1ラウンドの結果を保存する(管理者=ホストのみ)。`result` の形は shared/results.ts の QuizRoundResult。 */
export interface PutQuizResultArgs {
  sessionId: string;
  result: unknown;
}

/** ジャックポットの抽選結果を1件保存する(管理者=ホストのみ)。`draw` の形は JackpotDraw。 */
export interface PutJackpotDrawArgs {
  sessionId: string;
  draw: unknown;
}

export interface DeleteJackpotDrawArgs {
  sessionId: string;
  drawId: string;
}

/** 保存した結果の更新番号。ホストが RoomState の `results` スライスで参加者へ知らせる。 */
export interface ResultsRevResult {
  rev: number;
}

export interface GetResultsArgs {
  sessionId: string;
}

/**
 * ログイン済みの参加者が、ポータル公開中のセッションに入る。
 * メンバーID・表示名はサーバーがログインのトークンから決める(クライアントの申告は受け取らない)。
 */
export interface JoinPortalArgs {
  /** リロード復帰用。同じメンバーの端末で、deviceId と token の両方が一致したときだけ復帰する。 */
  deviceId?: string;
  token?: string;
}

/** Worker が Durable Object に渡す、参加者の入室。表示名はログインのトークンから決めたもの。 */
export interface RoomJoinPortalArgs extends JoinPortalArgs {
  label: string;
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

/**
 * timed: 受付時間(durationMs)で自動で締まる。クイズなど、時間を競う一斉回答。選択肢は2個以上。
 * open : 運営が締め切るまで開き続ける。エントリー受付など。選択肢は1個から。durationMs は使わない。
 */
export type RoundMode = "timed" | "open";

export interface OpenRoundArgs extends DeviceCredentials {
  /** ラウンドの識別子(例: "quizId:live")。結果の取得に使う。 */
  key: string;
  options: RoundOption[];
  /** timed のとき必須（MIN_ROUND_DURATION_MS 〜 MAX_ROUND_DURATION_MS）。 */
  durationMs?: number;
  /** 省略時は timed。 */
  mode?: RoundMode;
  /**
   * 同じ key のラウンドが締切済みなら、回答を残したまま受付を再開する(途中参加を受け付け直す)。
   * 受付中のラウンドには影響しない（従来どおり続きとして扱う）。
   */
  resume?: boolean;
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
  /** memberId がログインから確定したものか(Device.verified と同じ)。匿名の申告は false/未設定。 */
  verified?: boolean;
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
