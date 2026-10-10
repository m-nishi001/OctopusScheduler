/**
 * セッション(パーティールーム)の共有型・定数。クライアントとサーバの両方から使う。
 *
 * 端末は3種類の役割を持つ:
 *   - host  : プロジェクターに接続された実行端末。コマンドを受けて演出を進め、状態(RoomState)を公開する
 *   - admin : 遠隔操作する管理端末。コマンドを発行する
 *   - client: 参加者の端末(スマホ等)。公開された状態を見て、許可された入力だけを送れる
 */
export const DEVICE_ROLES = ["host", "admin", "client"] as const;
export type DeviceRole = (typeof DEVICE_ROLES)[number];
/** 管理系ログイン(アカウント必須)で参加する役割。 */
export type OperatorRole = Exclude<DeviceRole, "client">;

export const SESSION_MODES = ["live", "demo"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_STATUSES = ["lobby", "live", "closed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface SessionMeta {
  id: string;
  /** 参加コード。クライアントはこのコード(またはQR)でセッションを探す。 */
  code: string;
  name: string;
  ownerMemberId: string;
  status: SessionStatus;
  mode: SessionMode;
  createdAtMs: number;
  expiresAtMs: number;
  /** 現在のホスト端末。未接続は null。 */
  hostDeviceId: string | null;
}

/** 画面表示に必要なセッション情報(参加者にも見せてよい項目のみ)。 */
export type SessionInfo = Pick<SessionMeta, "id" | "code" | "name" | "mode" | "status" | "hostDeviceId">;

/** 一覧表示用の要約(セッション一覧のインデックスに保存する)。 */
export interface SessionSummary {
  id: string;
  code: string;
  name: string;
  status: SessionStatus;
  mode: SessionMode;
  ownerMemberId: string;
  createdAtMs: number;
  /** 終了した時刻(一覧から外すまでの猶予の起点)。 */
  closedAtMs?: number;
}

export interface Device {
  deviceId: string;
  sessionId: string;
  role: DeviceRole;
  /** ログイン済みアカウント、または参加者として選んだメンバー。 */
  memberId: string | null;
  label: string;
  /** 端末認証用のトークン。サーバ側にのみ保存し、他端末へは返さない。 */
  token: string;
  joinedAtMs: number;
}

/** 他端末へ見せてよい端末情報(トークンを含まない)。 */
export type PublicDevice = Omit<Device, "token">;

/**
 * 管理/クライアントがホストへ送る指示。追記型で、seq はセッション内で単調増加。
 * ホストは seq 順に冪等に適用する(同じ seq を二度適用しない)。
 */
export interface Command {
  seq: number;
  /** クライアントが付ける再送判定用ID。同じIDの再送は同じ seq を返す。 */
  requestId: string;
  /** ゲーム名前空間(例: "jackpot" / "quiz" / "scheduler")。 */
  game: string;
  /** コマンド種別(例: "setScreen" / "advance")。 */
  type: string;
  payload: unknown;
  issuedBy: string;
  issuerRole: DeviceRole;
  atMs: number;
}

/**
 * ホストが権威として公開する現在の状態。管理・クライアントはこれを表示する。
 * version は publish のたびに増える。
 */
export interface RoomState {
  version: number;
  /** ゲームごとの任意の状態(JSON)。サイズ上限あり。 */
  data: Record<string, unknown>;
  /** いまクライアントから受け付けるコマンド種別("game.type" 形式)。空なら入力不可。 */
  clientInput: string[];
  updatedAtMs: number;
}

export interface SessionHead {
  /** 最後に発行されたコマンドの seq(未発行は 0)。 */
  seq: number;
  /** RoomState.version(未公開は 0)。 */
  stateVersion: number;
  updatedAtMs: number;
}

export interface PresenceEntry {
  deviceId: string;
  role: DeviceRole;
  label: string;
  /** 最後にポーリング/接続を確認した時刻。 */
  seenAtMs: number;
  /** ホストが適用済みと報告した最後の seq(host のみ意味を持つ)。 */
  ackSeq: number;
}

/** 端末の在席状況。クライアントは人数のみ、運営端末は個別に返す。 */
export interface PresenceView {
  host: PresenceEntry | null;
  admins: PresenceEntry[];
  clientCount: number;
}

// ---- 制限値(GAS の 9KB/値、無料枠の予算を前提にした上限) ----
/** コマンドを保持するリングバッファの長さ。これを超えて遅れた端末は resync する。 */
export const COMMAND_RING_SIZE = 64;
export const MAX_COMMAND_PAYLOAD_BYTES = 1024;
export const MAX_STATE_BYTES = 6000;
export const MAX_ACTIVE_SESSIONS = 30;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/**
 * この時間ポーリングが無いホストは「不在」とみなし、別端末が引き継げる。
 * 在席の書き込み間引き(10秒)+ホストの最長ポーリング間隔(4秒)より十分長くする。
 */
export const HOST_STALE_MS = 30_000;
/** 管理端末/クライアントを「在席」とみなす猶予(最長ポーリング間隔+書き込み間引きより長く)。 */
export const ADMIN_ALIVE_MS = 45_000;
export const CLIENT_ALIVE_MS = 60_000;
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function commandKey(game: string, type: string): string {
  return `${game}.${type}`;
}

// ---- 回答ラウンド ----
export const ROUND_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,80}$/;
export const MAX_ROUND_OPTIONS = 8;
export const MAX_ROUND_OPTION_TEXT = 100;
export const MIN_ROUND_DURATION_MS = 1_000;
export const MAX_ROUND_DURATION_MS = 10 * 60 * 1000;
/** KV(GAS の1値 ~9KB)で保持できる回答数の目安。Durable Object はこれより大きく取れる。 */
export const MAX_ROUND_ANSWERS_KV = 100;
export const MAX_ROUND_ANSWERS_DO = 1000;

/** クライアントが採番する端末ID(入室の再送を冪等にするため)。 */
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** "jackpot.advance" のような `game.type` 形式か。 */
export const COMMAND_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,23}\.[a-z][a-zA-Z0-9]{0,31}$/;
