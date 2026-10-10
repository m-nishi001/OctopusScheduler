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
 * クイズの1回の実施を本番(live)とデモ(demo)に分ける区分。回答ラウンドのキーに含めるため、
 * デモ実行が本番の回答に影響しない。
 */
export type QuizSessionScope = "live" | "demo";

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
}

/** `QuizGameApi` をDI解決するためのトークン。 */
export const IQuizGameApiToken = Symbol("IQuizGameApi");
