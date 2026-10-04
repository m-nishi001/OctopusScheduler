/**
 * ストレージ論理パスの唯一の定義場所。
 *
 * 全てのアセット/JSONは `<module>/<kind>/<name>` というルート相対パスで指す。
 * ルートの実体はアダプタが決める(GAS: ScriptProperty `OCTOPUS_ROOT_FOLDER_ID` の
 * Driveフォルダ、Cloudflare: R2バケット直下)ので、呼び出し側は環境を意識しない。
 * パス文字列はこのファイルのヘルパー経由でのみ組み立て、直書きしない。
 */

export const StorageModule = {
  Scheduler: "octopus-scheduler",
  Jackpot: "jackpot-game",
  Quiz: "quiz-game",
} as const;
export type StorageModuleName = (typeof StorageModule)[keyof typeof StorageModule];

export const StorageKind = {
  Assets: "assets",
  Json: "json",
} as const;
export type StorageKindName = (typeof StorageKind)[keyof typeof StorageKind];

function assertSegment(segment: string): void {
  if (!segment || segment === "." || segment === ".." || segment.includes("/")) {
    throw new Error(`Invalid storage path segment: "${segment}"`);
  }
}

/** `<module>/<kind>` 形式の名前空間(ディレクトリ相当)を返す。 */
export function storageNamespace(module: StorageModuleName, kind: StorageKindName): string {
  return `${module}/${kind}`;
}

/** `<module>/<kind>/<segments...>` 形式のキーを返す。各セグメントは `/` を含められない。 */
export function storagePath(
  module: StorageModuleName,
  kind: StorageKindName,
  ...segments: string[]
): string {
  segments.forEach(assertSegment);
  return [storageNamespace(module, kind), ...segments].join("/");
}
