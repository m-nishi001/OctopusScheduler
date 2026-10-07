/**
 * quiz-game の GAS エンドポイント契約(唯一の正準定義)。
 *
 * クライアント(client/model/domains/repositories)とサーバー(server/endpoints.ts)の
 * 両方がここから型を参照する。エンドポイント名一覧は infrastructures/gas の
 * esbuild banner/footer コード生成、および scripts/gas-contract.js の集約対象になる。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";
import type {
  DriveData,
  DriveJsonData,
  DriveMetadata,
} from "@octopus/infrastructures/compositions";

export const QUIZ_GAME_PREFIX = "quizGame" as const;

export const QUIZ_GAME_ENDPOINTS = [
  "addDriveData",
  "getDriveMetaData",
  "getDriveData",
  "updateDriveData",
  "addJson",
  "getJson",
  "loginParticipant",
  "resolveDeviceToken",
  "startAcceptingAnswers",
  "stopAcceptingAnswers",
  "getAcceptanceState",
  "submitAnswer",
  "getAnswers",
  "getWebAppUrl",
] as const;

export type QuizGameEndpointName = (typeof QUIZ_GAME_ENDPOINTS)[number];

export type QuizGameFunctionName =
  `${typeof QUIZ_GAME_PREFIX}_${QuizGameEndpointName}`;

export interface QuizWithDataUrl {
  id: string;
  title: string;
  question: string;
  options: { no: number; text: string; color: string; image: string | null }[];
  correctNo: number;
  timeLimit: number;
  bgm: string | null;
  settings?: {
    correctBgmDataUrl: string | null;
    prizeImageDataUrl: string | null;
    prizeName: string;
    prizeBgmDataUrl: string | null;
  };
}

// GAS function argument types
export interface AddDriveDataArgs {
  driveData: DriveData;
}

export interface GetDriveMetaDataArgs {
  folderId?: string;
}

export interface GetDriveDataArgs {
  dataId: string;
}

export interface UpdateDriveDataArgs {
  driveData: DriveData;
}

export interface AddJsonArgs {
  driveJson: DriveJsonData;
}

export interface GetJsonArgs {
  fileId?: string;
}

/**
 * 参加者の端末ログインセッション。token は端末の localStorage に保存し、
 * 以降のリクエストで userId 入力を省略するために使う。
 */
export interface ParticipantSession {
  token: string;
  userId: string;
  displayName: string;
}

export interface LoginParticipantArgs {
  userId: string;
}

export interface ResolveDeviceTokenArgs {
  token: string;
}

/**
 * 参加者の回答画面に表示する選択肢メタデータ。参加者の端末には正解情報を
 * 一切渡さないため、画像やcorrectNoは含めない(テキスト+色のボタンのみ表示する)。
 */
/**
 * クイズの1回の実施を隔離する単位。本番(live)とデモ(demo)で受付状態・回答のKVキーが
 * 分かれるため、プレビュー実行が本番データに影響しない。
 */
export type QuizSessionScope = "live" | "demo";

export interface AcceptanceOption {
  no: number;
  text: string;
  color: string;
}

/**
 * クイズ1問分の回答受付状態。acceptStartedAtMs は「出題前に回答できてしまう」
 * バグの修正のため、集計時にこの時刻未満のタイムスタンプを除外する基準として使う。
 * options は回答受付開始時に呼び出し側(quiz-play.vue)から渡され、参加者端末は
 * ポーリングで取得したこの options だけを頼りにボタンを描画する。
 */
export interface AcceptanceState {
  quizId: string;
  isAccepting: boolean;
  acceptStartedAtMs: number | null;
  options: AcceptanceOption[];
}

export interface StartAcceptingAnswersArgs {
  quizId: string;
  scope: QuizSessionScope;
  options: AcceptanceOption[];
}

export interface StopAcceptingAnswersArgs {
  quizId: string;
  scope: QuizSessionScope;
}

export interface GetAcceptanceStateArgs {
  quizId: string;
  scope: QuizSessionScope;
}

/** 参加者から実際に届いた1件の回答。タイムスタンプはサーバー受信時刻。 */
export interface SubmittedAnswer {
  userId: string;
  displayName: string;
  optionNo: number;
  serverTimestampMs: number;
}

export interface SubmitAnswerArgs {
  quizId: string;
  scope: QuizSessionScope;
  token: string;
  optionNo: number;
}

export interface GetAnswersArgs {
  quizId: string;
  scope: QuizSessionScope;
}

/**
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。各メソッドの引数・戻り値は `server/endpoints.ts` と
 * その先の use-case 実装の実際のシグネチャに合わせている。
 */
export interface QuizGameApi {
  addDriveData(args: AddDriveDataArgs, options?: ApiCallOptions): Promise<DriveMetadata>;
  getDriveMetaData(
    args: GetDriveMetaDataArgs,
    options?: ApiCallOptions
  ): Promise<DriveMetadata[]>;
  getDriveData(args: GetDriveDataArgs, options?: ApiCallOptions): Promise<DriveData>;
  updateDriveData(args: UpdateDriveDataArgs, options?: ApiCallOptions): Promise<void>;
  addJson(args: AddJsonArgs, options?: ApiCallOptions): Promise<DriveMetadata>;
  /**
   * updatedAt: 解決されたファイルの最終更新日時(ISO文字列)。バックグラウンド
   * 同期のLast-Write-Winsに使う。ファイルが見つからない場合はnull。
   */
  getJson(
    args: GetJsonArgs,
    options?: ApiCallOptions
  ): Promise<{ json: string; updatedAt: string | null }>;
  loginParticipant(
    args: LoginParticipantArgs,
    options?: ApiCallOptions
  ): Promise<ParticipantSession>;
  resolveDeviceToken(
    args: ResolveDeviceTokenArgs,
    options?: ApiCallOptions
  ): Promise<ParticipantSession>;
  startAcceptingAnswers(
    args: StartAcceptingAnswersArgs,
    options?: ApiCallOptions
  ): Promise<AcceptanceState>;
  stopAcceptingAnswers(
    args: StopAcceptingAnswersArgs,
    options?: ApiCallOptions
  ): Promise<AcceptanceState>;
  getAcceptanceState(
    args: GetAcceptanceStateArgs,
    options?: ApiCallOptions
  ): Promise<AcceptanceState>;
  submitAnswer(args: SubmitAnswerArgs, options?: ApiCallOptions): Promise<SubmittedAnswer>;
  getAnswers(args: GetAnswersArgs, options?: ApiCallOptions): Promise<SubmittedAnswer[]>;
  /**
   * 参加者がスマホで開けるWebアプリの公開URL。GASのiframe内ではwindow.locationが
   * 内側のサンドボックスURL(userCodeAppPanel)になり単独では開けないため、サーバーから取得する。
   * 取得できない環境(Cloudflare等)ではnullを返し、クライアントはwindow.locationで代替する。
   */
  getWebAppUrl(args?: undefined, options?: ApiCallOptions): Promise<{ url: string | null }>;
}

/** `QuizGameApi` をDI解決するためのトークン。 */
export const IQuizGameApiToken = Symbol("IQuizGameApi");
