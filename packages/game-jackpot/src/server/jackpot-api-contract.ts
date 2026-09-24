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
  "setRemoteScreen",
  "advanceRemoteAction",
  "getRemoteControlState",
] as const;

/**
 * 管理画面(運営者のスマホ等)から本番の演出画面(会場のスクリーン)を
 * リモート制御するための対象画面。演出画面側はこの値に応じて画面遷移する。
 */
export const JACKPOT_REMOTE_SCREENS = [
  "home",
  "opening",
  "description",
  "demo",
  "main-draw",
  "result",
  "ending",
] as const;

export type JackpotRemoteScreen = (typeof JACKPOT_REMOTE_SCREENS)[number];

/**
 * リモート制御の共有状態。管理画面が書き込み、演出画面がポーリングして読む。
 * - screen: 演出画面が今表示すべき画面。未設定(null)の間はリモート制御が
 *   一度も使われていない状態を表し、演出画面側の既存のローカル画面遷移
 *   (同一デバイスでの直接操作)を一切妨げない。
 * - actionSeq: 「次へ」(本番画面でのEnterキー相当の進行操作)が呼ばれるたびに
 *   1ずつ増える単調増加カウンタ。演出画面側は前回ポーリング時からの増分だけを
 *   進行のトリガーとして扱う。
 */
export interface RemoteControlState {
  screen: JackpotRemoteScreen | null;
  actionSeq: number;
  updatedAtMs: number;
}

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
  setRemoteScreen(
    screen: JackpotRemoteScreen,
    options?: ApiCallOptions
  ): Promise<RemoteControlState>;
  advanceRemoteAction(options?: ApiCallOptions): Promise<RemoteControlState>;
  getRemoteControlState(options?: ApiCallOptions): Promise<RemoteControlState>;
}

/** `JackpotGameApi` をDI解決するためのトークン。 */
export const IJackpotGameApiToken = Symbol("IJackpotGameApi");
