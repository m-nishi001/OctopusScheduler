/**
 * octopus-scheduler(ホスト本体)の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。`doGet` は GAS Web アプリの
 * エントリポイントで、HtmlService の呼び出しはこのファイルに留める
 * (エントリポイント固有の関心事であり、ポート化しない)。
 */
import { respond, IKeyValueStorageToken, ILockToken } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import type { IKeyValueStorage, ILock } from "@octopus/infrastructures/interfaces";
import type { OctopusSchedulerEndpointName } from "./scheduler-api-contract";
import { ASSET_RECORD_FILE, OCTOPUS_SCHEDULER_PREFIX, assetRecordHashes } from "./scheduler-api-contract";

import { createDriveAssets, createHashedBlobStore, StorageKind, StorageModule } from "@octopus/infrastructures/compositions";
import { secure } from "@octopus/accounts/secure";

/** この置き場のファイルの一覧・取得(スライドショーのフォルダ表示用)。 */
const assets = createDriveAssets(StorageModule.Scheduler, StorageKind.Assets);
/** 素材の一覧と、一覧が参照する素材の中身(内容のハッシュを名前にしたファイル)の保存。 */
const store = createHashedBlobStore(StorageModule.Scheduler);

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    lock: container.resolve<ILock>(ILockToken),
  };
}

declare let _octopusScheduler_doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;
declare let _octopusScheduler_getDriveMetaData: (folderName?: string) => Promise<string>;
declare let _octopusScheduler_getDriveData: (dataId: string) => Promise<string>;
declare let _octopusScheduler_getAssetRecord: () => Promise<string>;
declare let _octopusScheduler_saveAssetRecord: (args: { json: string }) => Promise<string>;
declare let _octopusScheduler_existsAssetBlobs: (args: { hashes: string[] }) => Promise<string>;
declare let _octopusScheduler_putAssetBlob: (args: { hash: string; dataUrl: string }) => Promise<string>;
declare let _octopusScheduler_getAssetBlob: (args: { hash: string }) => Promise<string>;

_octopusScheduler_getDriveMetaData = async (folderName?: string): Promise<string> => {
  return respond(() => assets.listMetadata(resolveDeps(), folderName));
};

_octopusScheduler_getDriveData = async (dataId: string): Promise<string> => {
  return respond(() => assets.get(resolveDeps(), dataId));
};

_octopusScheduler_getAssetRecord = async (): Promise<string> =>
  respond(() => store.getRecord(resolveDeps(), { fileName: ASSET_RECORD_FILE }));

_octopusScheduler_saveAssetRecord = async (args: { json: string }): Promise<string> =>
  respond(() => store.saveRecord(resolveDeps(), { fileName: ASSET_RECORD_FILE, json: args.json }, assetRecordHashes));

_octopusScheduler_existsAssetBlobs = async (args: { hashes: string[] }): Promise<string> =>
  respond(() => store.exists(resolveDeps(), args));

_octopusScheduler_putAssetBlob = async (args: { hash: string; dataUrl: string }): Promise<string> =>
  respond(() => store.put(resolveDeps(), args));

_octopusScheduler_getAssetBlob = async (args: { hash: string }): Promise<string> =>
  respond(() => store.get(resolveDeps(), args));

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
_octopusScheduler_getDriveMetaData = secure("admin", _octopusScheduler_getDriveMetaData);
_octopusScheduler_getDriveData = secure("admin", _octopusScheduler_getDriveData);
_octopusScheduler_getAssetRecord = secure("admin", _octopusScheduler_getAssetRecord);
_octopusScheduler_saveAssetRecord = secure("admin", _octopusScheduler_saveAssetRecord);
_octopusScheduler_existsAssetBlobs = secure("admin", _octopusScheduler_existsAssetBlobs);
_octopusScheduler_putAssetBlob = secure("admin", _octopusScheduler_putAssetBlob);
_octopusScheduler_getAssetBlob = secure("admin", _octopusScheduler_getAssetBlob);

/**
 * Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。
 * doGet は GAS の HtmlService エントリポイント固有の関心事であり、Cloudflare側は
 * 静的アセット配信で代替するため、ここには含めない。
 */
export const OCTOPUS_SCHEDULER_HANDLERS: Record<
  Exclude<OctopusSchedulerEndpointName, "doGet">,
  (args: any) => Promise<string>
> = {
  getDriveMetaData: _octopusScheduler_getDriveMetaData,
  getDriveData: _octopusScheduler_getDriveData,
  getAssetRecord: _octopusScheduler_getAssetRecord,
  saveAssetRecord: _octopusScheduler_saveAssetRecord,
  existsAssetBlobs: _octopusScheduler_existsAssetBlobs,
  putAssetBlob: _octopusScheduler_putAssetBlob,
  getAssetBlob: _octopusScheduler_getAssetBlob,
};

export { OCTOPUS_SCHEDULER_PREFIX };
