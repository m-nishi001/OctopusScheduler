/**
 * jackpot-game の GAS エンドポイント契約(唯一の正準定義)。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";

export const JACKPOT_GAME_PREFIX = "jackpotGame" as const;

export const JACKPOT_GAME_ENDPOINTS = [
  "getAssetRecord",
  "saveAssetRecord",
  "existsAssetBlobs",
  "putAssetBlob",
  "getAssetBlob",
  "addJson",
  "getJson",
] as const;

export type JackpotGameEndpointName = (typeof JACKPOT_GAME_ENDPOINTS)[number];

export type JackpotGameFunctionName =
  `${typeof JACKPOT_GAME_PREFIX}_${JackpotGameEndpointName}`;

/**
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。各メソッドの引数・戻り値は `server/endpoints.ts` と
 * その先の use-case 実装の実際のシグネチャに合わせている。
 */
/** 同期用のJSONテキスト1件の保存(ファイル名はサーバー側の保存先の名前)。 */
export interface JsonBlobWrite {
  fileName: string;
  json: string;
}

/**
 * 素材の一覧(カタログ)に載せる1件。素材の中身は持たず、内容のハッシュで参照する。
 * 一覧が正で、ハッシュのファイルは一覧から参照されている間だけサーバーに残る。
 * 景品や画面設定が素材を指すときの `id` は、作成時に決まり、同期で変わらない。
 */
export interface AssetRecordEntry {
  id: string;
  /** 中身の MIME タイプ。 */
  type: string;
  name: string;
  /** 中身の内容のハッシュ(`hashBlob`)。 */
  hash: string;
  size: number;
  uploadedAt: string;
  lastUpdated: string;
}

/** 素材の一覧のサーバー上の名前。 */
export const ASSET_RECORD_FILE = "asset-list.json";

/** 一覧が参照するハッシュ。一覧の形が違っても例外にしない(その場合は何も参照していない)。 */
export function assetRecordHashes(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return (data as Partial<AssetRecordEntry>[]).flatMap((e) => (typeof e?.hash === "string" ? [e.hash] : []));
}

export interface JackpotGameApi {
  /** 素材の一覧のテキストをそのまま返す。まだ保存されていなければ json は null。 */
  getAssetRecord(args?: undefined, options?: ApiCallOptions): Promise<{ json: string | null }>;
  /** 素材の一覧(`{ updatedAt, data }` のテキスト)を保存する。参照先のファイルが無ければ断り、一覧から外れたファイルを消す。 */
  saveAssetRecord(args: { json: string }, options?: ApiCallOptions): Promise<void>;
  existsAssetBlobs(args: { hashes: string[] }, options?: ApiCallOptions): Promise<{ existing: string[] }>;
  putAssetBlob(args: { hash: string; dataUrl: string }, options?: ApiCallOptions): Promise<void>;
  getAssetBlob(args: { hash: string }, options?: ApiCallOptions): Promise<{ dataUrl: string | null }>;
  /** 同期の `{ updatedAt, data }` のテキストを、中身を見ずにそのまま保存する。 */
  addJson(blob: JsonBlobWrite, options?: ApiCallOptions): Promise<void>;
  /** 保存してあるテキストをそのまま返す。まだ保存されていなければ json は null。 */
  getJson(fileName: string, options?: ApiCallOptions): Promise<{ json: string | null }>;
}

/** `JackpotGameApi` をDI解決するためのトークン。 */
export const IJackpotGameApiToken = Symbol("IJackpotGameApi");
