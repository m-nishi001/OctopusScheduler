/**
 * octopus-scheduler(ホスト本体)の GAS エンドポイント契約(唯一の正準定義)。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";
import type { DriveData, DriveMetadata } from "@octopus/infrastructures/compositions";

export const OCTOPUS_SCHEDULER_PREFIX = "octopusScheduler" as const;

export const OCTOPUS_SCHEDULER_ENDPOINTS = [
  "doGet",
  "addDriveData",
  "getDriveMetaData",
  "getDriveData",
  "updateDriveData",
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
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。`doGet` は GAS Web アプリのエントリポイントであり、
 * クライアントJSから `google.script.run` 経由で呼ばれることは無いため、
 * ここには含めない(コード生成・契約検証のための `OCTOPUS_SCHEDULER_ENDPOINTS`/
 * `OCTOPUS_SCHEDULER_UNPREFIXED_ENDPOINTS` には引き続き含める)。
 */
export interface OctopusSchedulerApi {
  addDriveData(driveData: DriveData, options?: ApiCallOptions): Promise<DriveMetadata>;
  getDriveMetaData(folderId?: string, options?: ApiCallOptions): Promise<DriveMetadata[]>;
  getDriveData(dataId: string, options?: ApiCallOptions): Promise<DriveData>;
  updateDriveData(driveData: DriveData, options?: ApiCallOptions): Promise<void>;
  getKeyboardShortcuts(
    args?: undefined,
    options?: ApiCallOptions
  ): Promise<{ shortcuts: KeyboardShortcutWireItem[]; config: unknown }>;
  setKeyboardShortcuts(
    payload: { shortcuts: KeyboardShortcutWireItem[]; config: unknown },
    options?: ApiCallOptions
  ): Promise<void>;
}

/** `OctopusSchedulerApi` をDI解決するためのトークン。 */
export const IOctopusSchedulerApiToken = Symbol("IOctopusSchedulerApi");
