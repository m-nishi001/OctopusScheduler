/**
 * jackpot-game の GAS エンドポイント契約(唯一の正準定義)。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";
import type {
  DriveData,
  DriveJsonData,
  DriveMetadata,
} from "@octopus/infrastructures/compositions";

export const JACKPOT_GAME_PREFIX = "jackpotGame" as const;

export const JACKPOT_GAME_ENDPOINTS = [
  "addDriveData",
  "getDriveMetaData",
  "getDriveData",
  "addJson",
  "getJson",
] as const;

export type JackpotGameEndpointName = (typeof JACKPOT_GAME_ENDPOINTS)[number];

export type JackpotGameFunctionName =
  `${typeof JACKPOT_GAME_PREFIX}_${JackpotGameEndpointName}`;

/**
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。各メソッドの引数・戻り値は `server/endpoints.ts` と
 * その先の use-case 実装(`drive-asset-use-cases.ts`, `add-json-blob-use-case.ts`,
 * `get-json-blob-use-case.ts`)の実際のシグネチャに合わせている。
 */
export interface JackpotGameApi {
  addDriveData(driveData: DriveData, options?: ApiCallOptions): Promise<DriveMetadata>;
  getDriveMetaData(folderId?: string, options?: ApiCallOptions): Promise<DriveMetadata[]>;
  getDriveData(dataId: string, options?: ApiCallOptions): Promise<DriveData>;
  addJson(driveJson: DriveJsonData, options?: ApiCallOptions): Promise<DriveMetadata>;
  getJson(fileId?: string, options?: ApiCallOptions): Promise<{ json: string }>;
}

/** `JackpotGameApi` をDI解決するためのトークン。 */
export const IJackpotGameApiToken = Symbol("IJackpotGameApi");
