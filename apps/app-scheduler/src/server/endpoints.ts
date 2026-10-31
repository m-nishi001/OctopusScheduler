/**
 * octopus-scheduler(ホスト本体)の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。`doGet` は GAS Web アプリの
 * エントリポイントで、HtmlService の呼び出しはこのファイルに留める
 * (エントリポイント固有の関心事であり、ポート化しない)。
 */
import { respond } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import {
  IKeyValueStorageToken,
} from "@octopus/infrastructures/interfaces";
import type {
  IKeyValueStorage,
} from "@octopus/infrastructures/interfaces";
import type { DriveData } from "@octopus/infrastructures/compositions";
import type { OctopusSchedulerEndpointName } from "./scheduler-api-contract";
import { OCTOPUS_SCHEDULER_PREFIX } from "./scheduler-api-contract";

import { createDriveAssets, StorageKind, StorageModule } from "@octopus/infrastructures/compositions";
import { secure } from "@octopus/accounts/secure";

/** この置き場の素材の保存・一覧・取得。 */
const assets = createDriveAssets(StorageModule.Scheduler, StorageKind.Assets);

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
  };
}

declare let _octopusScheduler_doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;
declare let _octopusScheduler_addDriveData: (driveData: DriveData) => Promise<string>;
declare let _octopusScheduler_getDriveMetaData: (folderName?: string) => Promise<string>;
declare let _octopusScheduler_getDriveData: (dataId: string) => Promise<string>;
declare let _octopusScheduler_updateDriveData: (driveData: DriveData) => Promise<string>;

_octopusScheduler_addDriveData = async (driveData: DriveData): Promise<string> => {
  return respond(() => assets.save(resolveDeps(), driveData));
};

_octopusScheduler_getDriveMetaData = async (folderName?: string): Promise<string> => {
  return respond(() => assets.listMetadata(resolveDeps(), folderName));
};

_octopusScheduler_getDriveData = async (dataId: string): Promise<string> => {
  return respond(() => assets.get(resolveDeps(), dataId));
};

_octopusScheduler_updateDriveData = async (driveData: DriveData): Promise<string> => {
  return respond(() => assets.save(resolveDeps(), driveData));
};

_octopusScheduler_doGet = (
  _e: GoogleAppsScript.Events.DoGet
): GoogleAppsScript.HTML.HtmlOutput => {
  try {
    try {
      // GAS固有のクリーンアップ: 保持しているスクリプトロックがあれば念のため解放する。
      // ドメインの排他制御とは無関係のため、ポート化せずここで直接呼ぶ。
      LockService.getScriptLock().releaseLock();
    } catch {
      // 既存挙動を保持: ロック解放の失敗は無視する。
    }

    const template = HtmlService.createTemplateFromFile("index");
    return template
      .evaluate()
      .setTitle("Sample App")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  } catch (error) {
    console.error(`Error in doGetInternal: ${(error as Error).stack}`);
    return HtmlService.createHtmlOutput(
      `<html><body><h1>エラー</h1><p>アプリケーションの読み込みに失敗しました。</p></body></html>`
    );
  }
};

// 認可ポリシー。読み取りも書き込みも管理者のみ(投影用の実行画面もログインして使う。参加者はセッションの公開エンドポイントだけを使う)。
_octopusScheduler_addDriveData = secure("admin", _octopusScheduler_addDriveData);
_octopusScheduler_getDriveMetaData = secure("admin", _octopusScheduler_getDriveMetaData);
_octopusScheduler_getDriveData = secure("admin", _octopusScheduler_getDriveData);
_octopusScheduler_updateDriveData = secure("admin", _octopusScheduler_updateDriveData);

/**
 * Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。
 * doGet は GAS の HtmlService エントリポイント固有の関心事であり、Cloudflare側は
 * 静的アセット配信で代替するため、ここには含めない。
 */
export const OCTOPUS_SCHEDULER_HANDLERS: Record<
  Exclude<OctopusSchedulerEndpointName, "doGet">,
  (args: any) => Promise<string>
> = {
  addDriveData: _octopusScheduler_addDriveData,
  getDriveMetaData: _octopusScheduler_getDriveMetaData,
  getDriveData: _octopusScheduler_getDriveData,
  updateDriveData: _octopusScheduler_updateDriveData,
};

export { OCTOPUS_SCHEDULER_PREFIX };
