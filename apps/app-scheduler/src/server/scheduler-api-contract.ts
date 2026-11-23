/**
 * octopus-scheduler(ホスト本体)の GAS エンドポイント契約(唯一の正準定義)。
 */
import type { ApiCallOptions, BlobRoute } from "@octopus/infrastructures/interfaces";
import type { DriveData, DriveMetadata } from "@octopus/infrastructures/compositions";
import { StorageModule } from "@octopus/infrastructures/compositions";

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
  "getScheduleEvents",
  "saveScheduleEvent",
  "deleteScheduleEvents",
  "importScheduleEvents",
  "markScheduleEvents",
] as const;

/**
 * 接頭辞を付けずトップレベル関数として公開する関数。
 * GAS の Web アプリは `doGet` を特別なエントリポイントとして要求するため、
 * `octopusScheduler_doGet` ではなく素の `doGet` として公開する必要がある。
 */
export const OCTOPUS_SCHEDULER_UNPREFIXED_ENDPOINTS = ["doGet"] as const;

/**
 * 素材のファイルの送受信先。Cloudflare はバイナリの `/blobs`、GAS は下の `putAssetBlob` / `getAssetBlob`(base64 のデータURL)。
 * この2つのエンドポイントは GAS 専用(Cloudflare の `/rpc` には載せない)。
 */
export const ASSET_BLOB_ROUTE: BlobRoute = {
  module: StorageModule.Scheduler,
  gasPut: "octopusScheduler_putAssetBlob",
  gasGet: "octopusScheduler_getAssetBlob",
};

export type OctopusSchedulerEndpointName =
  (typeof OCTOPUS_SCHEDULER_ENDPOINTS)[number];

export type OctopusSchedulerFunctionName =
  `${typeof OCTOPUS_SCHEDULER_PREFIX}_${OctopusSchedulerEndpointName}`;

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

/** 予定イベントの実行状態。未実行(pending)→ 実行中(running)→ 完了(completed)。 */
export const SCHEDULE_EXECUTION_STATUSES = ["pending", "running", "completed"] as const;
export type ScheduleExecutionStatus = (typeof SCHEDULE_EXECUTION_STATUSES)[number];

/**
 * サーバーに保存する予定イベント1件(日時は ISO 文字列)。種類ごとの固有の項目は、サーバーは中身を見ずにそのまま持つ
 * (形の検証はクライアントの `reviveAppEvent`)。
 */
export interface ScheduleEventJson {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  processedAt: string | null;
  registeredAt: string;
  updatedAt: string;
  [field: string]: unknown;
}

/** 予定イベントのサーバー上のレコード1件。イベントと、その実行状態(無いイベントは未実行)を、全端末で共有する。 */
export interface ScheduleEventRecord {
  version: 1;
  events: ScheduleEventJson[];
  /** イベント id → 実行状態。pending は持たない(無ければ未実行)。 */
  status: Record<string, ScheduleExecutionStatus>;
}

/** 予定イベントのレコードのサーバー上の名前。 */
export const SCHEDULE_EVENTS_RECORD_FILE = "schedule-events.json";

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
  /** 予定イベントと実行状態の、サーバー上の最新。まだ無ければ空。 */
  getScheduleEvents(args?: undefined, options?: ApiCallOptions): Promise<ScheduleEventRecord>;
  /** イベント1件の作成・更新(id が無ければ作成)。処理済み日時・登録日時は、すでにあるイベントのものを保つ。操作後の最新を返す。 */
  saveScheduleEvent(args: { event: ScheduleEventJson }, options?: ApiCallOptions): Promise<ScheduleEventRecord>;
  /** イベントを消す(実行状態も一緒に)。操作後の最新を返す。 */
  deleteScheduleEvents(args: { ids: string[] }, options?: ApiCallOptions): Promise<ScheduleEventRecord>;
  /** CSV取込の反映: 追加・更新するイベントと、消すイベントの id。操作後の最新を返す。 */
  importScheduleEvents(args: { upserts: ScheduleEventJson[]; deleteIds: string[] }, options?: ApiCallOptions): Promise<ScheduleEventRecord>;
  /** 再生で実行状態が変わったイベントの状態遷移。編集とは別の操作として適用するので、互いを上書きしない。操作後の最新を返す。 */
  markScheduleEvents(args: { ids: string[]; status: ScheduleExecutionStatus }, options?: ApiCallOptions): Promise<ScheduleEventRecord>;
}

/** `OctopusSchedulerApi` をDI解決するためのトークン。 */
export const IOctopusSchedulerApiToken = Symbol("IOctopusSchedulerApi");
