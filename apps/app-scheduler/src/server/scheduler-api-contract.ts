/**
 * octopus-scheduler(ホスト本体)の GAS エンドポイント契約(唯一の正準定義)。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";
import type { DriveData, DriveMetadata } from "@octopus/infrastructures/compositions";

export const OCTOPUS_SCHEDULER_PREFIX = "octopusScheduler" as const;

export const OCTOPUS_SCHEDULER_ENDPOINTS = [
  "doGet",
  "getDriveMetaData",
  "getDriveData",
  "getAssetRecord",
  "saveAssetRecord",
  "existsAssetBlobs",
  "putAssetBlob",
  "getAssetBlob",
  "getKeyboardShortcuts",
  "setKeyboardShortcuts",
] as const;

/**
 * 接頭辞を付けずトップレベル関数として公開する関数。
 * GAS の Web アプリは `doGet` を特別なエントリポイントとして要求するため、
 * `octopusScheduler_doGet` ではなく素の `doGet` として公開する必要がある。
 */
export const OCTOPUS_SCHEDULER_UNPREFIXED_ENDPOINTS = ["doGet"] as const;

export type OctopusSchedulerEndpointName =
  (typeof OCTOPUS_SCHEDULER_ENDPOINTS)[number];

export type OctopusSchedulerFunctionName =
  `${typeof OCTOPUS_SCHEDULER_PREFIX}_${OctopusSchedulerEndpointName}`;

/**
 * キーボードショートカット1件のワイヤー形式。GAS側はこの中身を解釈せず
 * JSON文字列として保存・返却するだけの不透明なKVストアであるため、
 * クライアントのローカル正準モデル(`KeyboardShortcutData`)とそのまま揃えている。
 */
export interface KeyboardShortcutWireItem {
  id: string;
  keys: string[];
  eventIds: string[];
}

/**
 * 素材の一覧(カタログ)に載せる1件。素材の中身は持たず、内容のハッシュで参照する。
 * 一覧が正で、ハッシュのファイルは一覧から参照されている間だけサーバーに残る。
 * 他のもの(イベントなど)が素材を指すときの `id` は、作成時に決まり、同期で変わらない。
 */
export interface AssetRecordEntry {
  id: string;
  name: string;
  /** 中身の MIME タイプ。 */
  mime: string;
  /** 中身の内容のハッシュ(`hashBlob`)。 */
  hash: string;
  size: number;
  uploadedAt: string;
  lastUpdated: string;
  directoryId?: string;
}

/** 素材の一覧のサーバー上の名前。 */
export const ASSET_RECORD_FILE = "asset-list.json";

/** 一覧が参照するハッシュ。一覧の形が違っても例外にしない(その場合は何も参照していない)。 */
export function assetRecordHashes(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return (data as Partial<AssetRecordEntry>[]).flatMap((e) => (typeof e?.hash === "string" ? [e.hash] : []));
}

/**
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。`doGet` は GAS Web アプリのエントリポイントであり、
 * クライアントJSから `google.script.run` 経由で呼ばれることは無いため、
 * ここには含めない(コード生成・契約検証のための `OCTOPUS_SCHEDULER_ENDPOINTS`/
 * `OCTOPUS_SCHEDULER_UNPREFIXED_ENDPOINTS` には引き続き含める)。
 */
export interface OctopusSchedulerApi {
  /** 置き場直下(またはサブフォルダ1階層)のファイルの一覧。スライドショーのフォルダ表示が使う。 */
  getDriveMetaData(folderName?: string, options?: ApiCallOptions): Promise<DriveMetadata[]>;
  getDriveData(dataId: string, options?: ApiCallOptions): Promise<DriveData>;
  /** 素材の一覧のテキストをそのまま返す。まだ保存されていなければ json は null。 */
  getAssetRecord(args?: undefined, options?: ApiCallOptions): Promise<{ json: string | null }>;
  /** 素材の一覧(`{ updatedAt, data }` のテキスト)を保存する。参照先のファイルが無ければ断り、一覧から外れたファイルを消す。 */
  saveAssetRecord(args: { json: string }, options?: ApiCallOptions): Promise<void>;
  existsAssetBlobs(args: { hashes: string[] }, options?: ApiCallOptions): Promise<{ existing: string[] }>;
  putAssetBlob(args: { hash: string; dataUrl: string }, options?: ApiCallOptions): Promise<void>;
  getAssetBlob(args: { hash: string }, options?: ApiCallOptions): Promise<{ dataUrl: string | null }>;
  getKeyboardShortcuts(
    args?: undefined,
    options?: ApiCallOptions
  ): Promise<{
    shortcuts: KeyboardShortcutWireItem[];
    config: unknown;
    /** 最終更新日時(ISO文字列)。バックグラウンド同期のLast-Write-Winsに使う。
     * 一度もpushされたことがない旧形式のデータの場合はnull。 */
    updatedAt: string | null;
  }>;
  setKeyboardShortcuts(
    payload: {
      shortcuts: KeyboardShortcutWireItem[];
      config: unknown;
      /** クライアントがpush時に刻む更新日時(ISO文字列)。 */
      updatedAt: string;
    },
    options?: ApiCallOptions
  ): Promise<void>;
}

/** `OctopusSchedulerApi` をDI解決するためのトークン。 */
export const IOctopusSchedulerApiToken = Symbol("IOctopusSchedulerApi");
