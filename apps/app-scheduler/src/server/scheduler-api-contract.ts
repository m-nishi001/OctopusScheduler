/**
 * octopus-scheduler(ホスト本体)の GAS エンドポイント契約(唯一の正準定義)。
 */
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
